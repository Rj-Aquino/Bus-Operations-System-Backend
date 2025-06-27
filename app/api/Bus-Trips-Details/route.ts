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

  const { searchParams } = new URL(request.url);
  const filterBy = searchParams.get("RequestType")?.toLowerCase(); // "revenue", "expense", or null

  // Build trip condition dynamically
  const tripConditions: any = {
    TripExpense: { not: null },
    Sales: { not: null },
  };

  // Apply extra condition based on filterBy
  if (filterBy === "revenue") {
    tripConditions.IsRevenueRecorded = false;
  } else if (filterBy === "expense") {
    tripConditions.IsExpenseRecorded = false;
  } else {
    // Default: filter those that are not fully recorded
    tripConditions.OR = [
      { IsRevenueRecorded: false },
      { IsExpenseRecorded: false },
    ];
  }

  // Fetch assignments
  const assignments = await prisma.busAssignment.findMany({
    where: {
      IsDeleted: false,
      RegularBusAssignment: {
        BusTrips: {
          some: tripConditions,
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
            where: tripConditions,
            select: {
              BusTripID: true,
              DispatchedAt: true,
              TripExpense: true,
              Sales: true,
              Payment_Method: true,
              IsExpenseRecorded: true,
              IsRevenueRecorded: true,
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
    fetchExternal(`${process.env.BASE_URL}${process.env.EXTERNAL_DRIVER_URL}`, token ?? ''),
    fetchExternal(`${process.env.BASE_URL}${process.env.EXTERNAL_CONDUCTOR_URL}`, token ?? ''),
    fetchExternal(`${process.env.BASE_URL}${process.env.EXTERNAL_BUS_URL}`, token ?? ''),
  ]);

  const driversArr = Array.isArray(drivers) ? drivers : drivers?.data ?? [];
  const conductorsArr = Array.isArray(conductors) ? conductors : conductors?.data ?? [];
  const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];

  const driverMap = Object.fromEntries(driversArr.map((d: any) => [d.driver_id, d]));
  const conductorMap = Object.fromEntries(conductorsArr.map((c: any) => [c.conductor_id, c]));
  const busMap = Object.fromEntries(busesArr.map((b: any) => [b.busId, b]));

  const result = assignments.flatMap(a => {
    const busTrips = a.RegularBusAssignment?.BusTrips || [];
    const quotaPolicies = a.RegularBusAssignment?.QuotaPolicies || [];
    const driver = driverMap[a.RegularBusAssignment?.DriverID ?? ''];
    const conductor = conductorMap[a.RegularBusAssignment?.ConductorID ?? ''];
    const bus = busMap[a.BusID ?? ''];

    return busTrips.map(trip => {
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
        is_revenue_recorded: trip?.IsRevenueRecorded ?? false,
        is_expense_recorded: trip?.IsExpenseRecorded ?? false,
        date_assigned: trip?.DispatchedAt?.toISOString() ?? null,
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

    const updates = body.filter((item) => typeof item?.bus_trip_id === 'string');

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid bus_trip_id values found' }, { status: 400 });
    }

    const results = await Promise.allSettled(
      updates.map((item) => {
        const updateData: Record<string, any> = {
          UpdatedBy: user?.employeeId || null,
        };

        if ('IsRevenueRecorded' in item && typeof item.IsRevenueRecorded === 'boolean') {
          updateData.IsRevenueRecorded = item.IsRevenueRecorded;
        }

        if ('IsExpenseRecorded' in item && typeof item.IsExpenseRecorded === 'boolean') {
          updateData.IsExpenseRecorded = item.IsExpenseRecorded;
        }

        if (Object.keys(updateData).length <= 1) {
          // Only UpdatedBy is included, skip this update.
          return Promise.reject(new Error('No update fields provided'));
        }

        return prisma.busTrip.update({
          where: { BusTripID: item.bus_trip_id },
          data: updateData,
          select: {
            BusTripID: true,
            IsRevenueRecorded: true,
            IsExpenseRecorded: true,
            UpdatedBy: true,
          },
        });
      })
    );

    const updated = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const failed = results
      .map((r, i) => ({ result: r, id: updates[i]?.bus_trip_id }))
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