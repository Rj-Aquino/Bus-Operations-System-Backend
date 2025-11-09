import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { withCors } from '@/lib/withcors';
import { authenticateRequest } from '@/lib/auth';
import { fetchNewDrivers, fetchNewConductors, fetchNewBuses } from "@/lib/fetchExternal";

const getAssignmentSummary = async (request: NextRequest) => {
  const { error, token, status } = await authenticateRequest(request);
  // If you want authentication back:
  // if (error) return NextResponse.json({ error }, { status });

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
    tripConditions.OR = [
      { IsRevenueRecorded: false },
      { IsExpenseRecorded: false },
    ];
  }

  // Fetch assignments from Prisma
  const assignments = await prisma.busAssignment.findMany({
    where: {
      IsDeleted: false,
      RegularBusAssignment: {
        BusTrips: { some: tripConditions },
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

  // Fetch external or fallback data
  const [drivers, conductors, buses] = await Promise.all([
    fetchNewDrivers(),
    fetchNewConductors(),
    fetchNewBuses(),
  ]);

  // Normalize into arrays
  const driversArr = Array.isArray(drivers) ? drivers : drivers?.data ?? [];
  const conductorsArr = Array.isArray(conductors) ? conductors : conductors?.data ?? [];
  const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];

  // Build quick lookup maps
  const driverMap = Object.fromEntries(driversArr.map((d: any) => [d.employeeNumber ?? d.driver_id, d]));
  const conductorMap = Object.fromEntries(conductorsArr.map((c: any) => [c.employeeNumber ?? c.conductor_id, c]));
  const busMap = Object.fromEntries(busesArr.map((b: any) => [b.bus_id ?? b.busId, b]));

  // Flatten and format results
  const result = assignments.flatMap(a => {
    const busTrips = a.RegularBusAssignment?.BusTrips || [];
    const quotaPolicies = a.RegularBusAssignment?.QuotaPolicies || [];

    const driver = driverMap[a.RegularBusAssignment?.DriverID ?? ""];
    const conductor = conductorMap[a.RegularBusAssignment?.ConductorID ?? ""];
    const bus = busMap[a.BusID ?? ""];

    return busTrips.map(trip => {
      // Match quota policy
      const quotaPolicy = quotaPolicies.find(qp =>
        qp.StartDate && qp.EndDate && trip.DispatchedAt &&
        trip.DispatchedAt >= qp.StartDate && trip.DispatchedAt <= qp.EndDate
      );

      // Determine assignment type/value
      let assignment_type = null;
      let assignment_value = null;
      if (quotaPolicy?.Fixed) {
        assignment_type = "BOUNDARY";
        assignment_value = quotaPolicy.Fixed.Quota;
      } else if (quotaPolicy?.Percentage) {
        assignment_type = "PERCENTAGE";
        assignment_value = quotaPolicy.Percentage.Percentage;
      } else {
        assignment_type = "BUS RENTAL";
        assignment_value = null;
      }

      return {
        assignment_id: a.BusAssignmentID,
        bus_trip_id: trip.BusTripID,
        bus_route: a.Route?.RouteName || null,
        is_revenue_recorded: trip.IsRevenueRecorded ?? false,
        is_expense_recorded: trip.IsExpenseRecorded ?? false,
        date_assigned: trip.DispatchedAt ? trip.DispatchedAt.toISOString() : null,
        trip_fuel_expense: trip.TripExpense ?? null,
        trip_revenue: trip.Sales ?? null,
        assignment_type,
        assignment_value,
        payment_method: trip.Payment_Method ?? null,

        // driver
        employee_driver: driver
          ? {
              employee_id: driver.employeeNumber ?? driver.driver_id,
              employee_firstName: driver.firstName ?? driver.name?.split(" ")[0] ?? null,
              employee_middleName: driver.middleName ?? null,
              employee_lastName: driver.lastName ?? driver.name?.split(" ")[1] ?? null,
              employee_suffix: driver.suffix ?? null,
            }
          : null,

        // conductor
        employee_conductor: conductor
          ? {
              employee_id: conductor.employeeNumber ?? conductor.conductor_id,
              employee_firstName: conductor.firstName ?? conductor.name?.split(" ")[0] ?? null,
              employee_middleName: conductor.middleName ?? null,
              employee_lastName: conductor.lastName ?? conductor.name?.split(" ")[1] ?? null,
              employee_suffix: conductor.suffix ?? null,
            }
          : null,

        // bus
        bus_plate_number: bus.plate_number ?? bus.license_plate ?? null,
        bus_type: bus.bus_type ?? bus.type ?? null,
        body_number: bus.body_number ?? null,
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