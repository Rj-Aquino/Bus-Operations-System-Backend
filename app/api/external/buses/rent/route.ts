import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import prisma from '@/client';
import { fetchNewBuses, fetchBuses } from '@/lib/fetchExternal';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const url = new URL(request.url);
    const busTypeParam = url.searchParams.get('busType'); // e.g. "Aircon" | "Non-Aircon"
    const startDateParam = url.searchParams.get('startDate'); // ISO string
    const durationParam = url.searchParams.get('duration'); // integer days

    let start: Date | null = null;
    let end: Date | null = null;

    if ((startDateParam && !durationParam) || (!startDateParam && durationParam)) {
      return NextResponse.json({ error: 'Both startDate and duration must be provided together' }, { status: 400 });
    }

    if (startDateParam && durationParam) {
      start = new Date(startDateParam);
      const duration = parseInt(durationParam, 10);
      if (isNaN(start.getTime()) || isNaN(duration) || duration < 0) {
        return NextResponse.json({ error: 'Invalid startDate or duration' }, { status: 400 });
      }
      end = new Date(start);
      end.setDate(start.getDate() + duration);
    }

    // collect BusIDs that have overlapping quota policies
    const excludedBusIDs = new Set<string>();
    if (start && end) {
      const policies = await prisma.quota_Policy.findMany({
        where: {
          AND: [
            { StartDate: { lte: end } },
            { EndDate: { gte: start } },
          ],
        },
        include: {
          regularBusAssignment: {
            include: { BusAssignment: true },
          },
        },
      });

      for (const p of policies) {
        const rba = (p as any).regularBusAssignment;
        const ba = rba?.BusAssignment;
        if (ba?.BusID) excludedBusIDs.add(String(ba.BusID));
      }
    }

    // fetch external buses
    let busesRaw: any[] = [];
    try {
      const nb = await fetchNewBuses();
      busesRaw = Array.isArray(nb) && nb.length ? nb : await fetchBuses().catch(() => []);
    } catch {
      busesRaw = [];
    }

    const normalizedBusType = busTypeParam ? String(busTypeParam).trim().toLowerCase() : null;

    const mapped = (busesRaw ?? []).map((bus: any) => {
      const raw = String(bus.bus_type ?? '').trim();
      const low = raw.toLowerCase();

      // simplified, robust detection
      let type = 'Unknown';
      if (low.includes('non')) type = 'Non-Aircon';
      else if (low.includes('air')) type = 'Aircon';
      else if (low.length === 0) type = 'Unknown';
      else type = raw[0].toUpperCase() + raw.slice(1);

      return {
        busId: String(bus.bus_id),
        plate_number: bus.plate_number ?? null,
        body_number: bus.body_number ?? null,
        bus_type_raw: bus.bus_type ?? null,
        type,
        seat_capacity: bus.seat_capacity ?? null,
      };
    });

    const filtered = mapped.filter((b: any) => {
      if (normalizedBusType) {
        const norm = normalizedBusType.replace(/[\s\-_]+/g, '');
        if (norm.includes('non')) {
          if (b.type !== 'Non-Aircon') return false;
        } else if (norm.includes('air')) {
          if (b.type !== 'Aircon') return false;
        } else {
          // fallback: match raw or computed type
          if (b.type.toLowerCase() !== normalizedBusType && String(b.bus_type_raw ?? '').toLowerCase() !== normalizedBusType) return false;
        }
      }

      // exclude buses with overlapping quota policies (compare strings)
      if (excludedBusIDs.has(String(b.busId))) return false;
      return true;
    });

    return NextResponse.json({ message: filtered.length ? undefined : 'No buses found', data: filtered }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('GET_AVAILABLE_BUSES_ERROR', msg);
    return NextResponse.json({ error: 'Failed to fetch available buses', details: msg }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));