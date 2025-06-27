import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { withCors } from '@/lib/withcors';
import { authenticateRequest } from '@/lib/auth';

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
  // if (error) {
  //   return NextResponse.json({ error }, { status });
  // }

  // Fetch assignments with needed IDs and all BusTrips
  const assignments = await prisma.busAssignment.findMany({
    where: {
      IsDeleted: false,
      RegularBusAssignment: {
        BusTrips: {
          some: {
            TripExpense: { not: null },
            Sales: { not: null },
            IsRevenueRecorded: false,
            IsExpenseRecorded: false,
          },
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
          BusTrips: {
            where: {
              TripExpense: { not: null },
              Sales: { not: null },
            },
            select: {
              BusTripID: true,
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

  const driversArr = Array.isArray(drivers) ? drivers : drivers?.data ?? [];
  const conductorsArr = Array.isArray(conductors) ? conductors : conductors?.data ?? [];
  const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];

  const driverMap = Object.fromEntries(driversArr.map((d: any) => [d.driver_id, d]));
  const conductorMap = Object.fromEntries(conductorsArr.map((c: any) => [c.conductor_id, c]));
  const busMap = Object.fromEntries(busesArr.map((b: any) => [b.busId, b]));

  // Map to the required format
  const result = assignments.flatMap(a => {
    const busTrips = a.RegularBusAssignment?.BusTrips || [];
    const quotaPolicies = a.RegularBusAssignment?.QuotaPolicies || [];
    // External info
    const driver = driverMap[a.RegularBusAssignment?.DriverID ?? ''];
    const conductor = conductorMap[a.RegularBusAssignment?.ConductorID ?? ''];
    const bus = busMap[a.BusID ?? ''];

    return busTrips.map(trip => {
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

      return {
        assignment_id: a.BusAssignmentID,
        bus_trip_id: trip.BusTripID,
        bus_route: a.Route?.RouteName || null,
        date_assigned: trip?.DispatchedAt ? trip.DispatchedAt.toISOString() : null,
        trip_fuel_expense: trip?.TripExpense ?? null,
        trip_revenue: trip?.Sales ?? null,
        assignment_type,
        assignment_value,
        payment_method: trip?.Payment_Method ?? null,
        driver_name: driver?.name ?? null,
        conductor_name: conductor?.name ?? null,
        bus_plate_number: bus?.license_plate ?? null,
        bus_type: bus?.type ?? null,
        body_number: bus?.body_number ?? null,
      };
    });
  });

  return NextResponse.json(result, { status: 200 });
};

const patchHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  // if (error) {
  //   return NextResponse.json({ error }, { status });
  // }

  try {
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected an array of records' }, { status: 400 });
    }

    const tripIds = body
      .map((item) => item?.bus_trip_id)
      .filter((id): id is string => typeof id === 'string');

    if (tripIds.length === 0) {
      return NextResponse.json({ error: 'No valid bus_trip_id values found' }, { status: 400 });
    }

    const results = await Promise.allSettled(
      tripIds.map((id) =>
        prisma.busTrip.update({
          where: { BusTripID: id },
          data: {
            IsRevenueRecorded: true,
            IsExpenseRecorded: true,
            UpdatedBy: user?.employeeId || null,
          },
          select: {
            BusTripID: true,
            IsRevenueRecorded: true,
            IsExpenseRecorded: true,
            UpdatedBy: true,
          },
        })
      )
    );

    const updated = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const failed = results
      .map((res, i) => ({ result: res, id: tripIds[i] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, id }) => ({
        bus_trip_id: id,
        reason: (result as PromiseRejectedResult).reason?.message || 'Update failed',
      }));

    return NextResponse.json({ updated, failed }, { status: 200 });
  } catch (error) {
    console.error('PATCH_BUS_TRIP_FLAGS_ERROR', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const GET = withCors(getAssignmentSummary);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));