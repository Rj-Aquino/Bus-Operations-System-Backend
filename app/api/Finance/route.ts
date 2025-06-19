import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { withCors } from '@/lib/withcors';
import { authenticateRequest } from '@/lib/auth';
import { BusOperationStatus } from '@prisma/client';

async function fetchExternal(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

const getAssignmentSummary = async (request: NextRequest) => {
  const { error, token, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Fetch assignments with needed IDs
  const assignments = await prisma.busAssignment.findMany({
    where: {
      IsDeleted: false,
      Status: BusOperationStatus.InOperation,
      RegularBusAssignment: {
        LatestBusTrip: {
          TripExpense: { not: null },
          Sales: { not: null },
        },
      },
    },
    select: {
      BusAssignmentID: true,
      BusID: true,
      Route: { select: { RouteName: true } },
      RegularBusAssignment: {
        select: {
          DriverID: true,
          ConductorID: true,
          LatestBusTrip: {
            select: {
              DispatchedAt: true,
              TripExpense: true,
              Sales: true,
              Payment_Method: true,
            },
          },
          QuotaPolicies: {
            select: {
              StartDate: true,
              EndDate: true,
              Fixed: { select: { Quota: true } },
              Percentage: { select: { Percentage: true } },
            },
          },
        },
      },
    },
  });

  // Gather unique IDs
  const driverIDs = [...new Set(assignments.map(a => a.RegularBusAssignment?.DriverID).filter(Boolean))];
  const conductorIDs = [...new Set(assignments.map(a => a.RegularBusAssignment?.ConductorID).filter(Boolean))];
  const busIDs = [...new Set(assignments.map(a => a.BusID).filter(Boolean))];

    // Fetch external data
    const [drivers, conductors, buses] = await Promise.all([
      fetchExternal(`${process.env.BASE_URL}/api/external/drivers/full`, token ?? ''),
      fetchExternal(`${process.env.BASE_URL}/api/external/conductors/full`, token ?? ''),
      fetchExternal(`${process.env.BASE_URL}/api/external/buses/full`, token ?? ''),
    ]);

    console.log(drivers, conductors, buses);

    const driversArr = Array.isArray(drivers) ? drivers : drivers?.data ?? [];
    const conductorsArr = Array.isArray(conductors) ? conductors : conductors?.data ?? [];
    const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];

    const driverMap = Object.fromEntries(driversArr.map((d: any) => [d.driver_id, d]));
    const conductorMap = Object.fromEntries(conductorsArr.map((c: any) => [c.conductor_id, c]));
    const busMap = Object.fromEntries(busesArr.map((b: any) => [b.busId, b]));

    // Map to the required format
    const result = assignments.map(a => {
    const trip = a.RegularBusAssignment?.LatestBusTrip;
    const quotaPolicies = a.RegularBusAssignment?.QuotaPolicies || [];

    // Find the quota policy where DispatchedAt is within StartDate and EndDate
    let quotaPolicy = null;
    if (trip?.DispatchedAt) {
      quotaPolicy = quotaPolicies.find(qp =>
        qp.StartDate && qp.EndDate &&
        trip.DispatchedAt != null &&
        trip.DispatchedAt >= qp.StartDate &&
        trip.DispatchedAt <= qp.EndDate
      );
    }

    let assignment_type = null;
    let assignment_value = null;
    if (quotaPolicy?.Fixed) {
      assignment_type = 'Boundary';
      assignment_value = quotaPolicy.Fixed.Quota;
    } else if (quotaPolicy?.Percentage) {
      assignment_type = 'Percentage';
      assignment_value = quotaPolicy.Percentage.Percentage;
    } else {
      assignment_type = 'Bus Rental';
      assignment_value = null;
    }

    // External info
    const driver = driverMap[a.RegularBusAssignment?.DriverID ?? ''];
    const conductor = conductorMap[a.RegularBusAssignment?.ConductorID ?? ''];
    const bus = busMap[a.BusID ?? ''];

    return {
      assignment_id: a.BusAssignmentID,
      bus_route: a.Route?.RouteName || null,
      date_assigned: trip?.DispatchedAt ? trip.DispatchedAt.toISOString() : null,
      trip_fuel_expense: trip?.TripExpense ?? null,
      trip_revenue: trip?.Sales ?? null,
      is_expense_recorded: trip?.TripExpense != null,
      is_revenue_recorded: trip?.Sales != null,
      assignment_type,
      assignment_value,
      payment_method: trip?.Payment_Method ?? null,
      driver_name: driver?.name ?? null,
      conductor_name: conductor?.name ?? null,
      bus_plate_number: bus?.license_plate ?? null,
      bus_type: bus?.type ?? null,
    };
  });

  return NextResponse.json(result, { status: 200 });
};

export const GET = withCors(getAssignmentSummary);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));