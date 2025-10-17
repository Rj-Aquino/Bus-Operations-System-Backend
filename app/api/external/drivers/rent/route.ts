import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import prisma from '@/client';
import { fetchNewDrivers, fetchDrivers } from '@/lib/fetchExternal';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const url = new URL(request.url);
    const startDateParam = url.searchParams.get('startDate'); // ISO string
    const durationParam = url.searchParams.get('duration'); // integer days

    if ((startDateParam && !durationParam) || (!startDateParam && durationParam)) {
      return NextResponse.json({ error: 'Both startDate and duration must be provided together' }, { status: 400 });
    }

    let start: Date | null = null;
    let end: Date | null = null;
    if (startDateParam && durationParam) {
      start = new Date(startDateParam);
      const duration = parseInt(durationParam, 10);
      if (isNaN(start.getTime()) || isNaN(duration) || duration < 0) {
        return NextResponse.json({ error: 'Invalid startDate or duration' }, { status: 400 });
      }
      end = new Date(start);
      end.setDate(start.getDate() + duration);
    }

    // collect driver IDs to exclude:
    // 1) drivers referenced in quota policies (regularBusAssignment.DriverID / ConductorID)
    // 2) drivers already assigned to rental requests whose RentalDate falls in the requested range
    const excludedDriverIds = new Set<string>();

    if (start && end) {
      // quota policies overlapping range -> collect driver/conductor from regularBusAssignment
      const policies = await prisma.quota_Policy.findMany({
        where: {
          AND: [{ StartDate: { lte: end } }, { EndDate: { gte: start } }],
        },
        include: {
          regularBusAssignment: {
            include: { BusAssignment: true },
          },
        },
      });

      for (const p of policies) {
        const rba = (p as any).regularBusAssignment;
        if (!rba) continue;
        if (rba.DriverID) excludedDriverIds.add(String(rba.DriverID));
        if (rba.ConductorID) excludedDriverIds.add(String(rba.ConductorID));
      }

      // rental requests in the same date range -> collect rental drivers assigned to those requests
      const rentalRequests = await prisma.rentalRequest.findMany({
        where: {
          AND: [
            { RentalDate: { gte: start } },
            { RentalDate: { lte: end } },
          ],
        },
        include: {
          RentalBusAssignment: {
            include: {
              RentalDrivers: true,
            },
          },
        },
      });

      for (const rr of rentalRequests) {
        const rba = (rr as any).RentalBusAssignment;
        if (!rba) continue;
        const drivers = rba.RentalDrivers ?? [];
        for (const d of drivers) {
          const did = d?.DriverID ?? d?.driver_id ?? d?.driverId;
          if (did) excludedDriverIds.add(String(did));
        }
      }
    }

    // Fetch external drivers (newer endpoint first, fallback to legacy)
    let employees: any[] = [];
    try {
      const nd = await fetchNewDrivers();
      employees = Array.isArray(nd) && nd.length ? nd : await fetchDrivers().catch(() => []);
    } catch {
      employees = [];
    }

    // Map external driver fields to a consistent shape
    const mapped = (employees ?? []).map((emp: any) => {
      const driverId = emp.employeeNumber ?? emp.driver_id ?? emp.driverId ?? emp.id ?? '';
      return {
        driver_id: String(driverId),
        name: [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ').trim(),
        contactNo: emp.phone ?? emp.contactNo ?? emp.mobile ?? null,
        address: [emp.barangay, emp.zipCode].filter(Boolean).join(', ').trim() || null,
        raw: emp,
      };
    });

    // Filter out drivers that are part of overlapping quota policies or already picked in the date range
    const filtered = mapped.filter(d => !excludedDriverIds.has(String(d.driver_id)));

    return NextResponse.json({ message: filtered.length ? undefined : 'No drivers found', data: filtered }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('GET_AVAILABLE_DRIVERS_ERROR', msg);
    return NextResponse.json({ error: 'Failed to fetch available drivers', details: msg }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));