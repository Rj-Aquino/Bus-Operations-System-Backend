import prisma from '@/client';
import { fetchNewDrivers, fetchNewConductors, fetchNewBuses } from '@/lib/fetchExternal';

export class BusTripsDetailsService {
  private buildTripConditions(filterBy: string | null): any {
    const tripConditions: any = {
      TripExpense: { not: null },
      Sales: { not: null },
    };

    if (filterBy === 'revenue') {
      tripConditions.IsRevenueRecorded = false;
    } else if (filterBy === 'expense') {
      tripConditions.IsExpenseRecorded = false;
    } else {
      tripConditions.OR = [{ IsRevenueRecorded: false }, { IsExpenseRecorded: false }];
    }

    return tripConditions;
  }

  private async buildLookupMaps(
    drivers: any[],
    conductors: any[],
    buses: any[]
  ): Promise<{
    driverMap: Record<string, any>;
    conductorMap: Record<string, any>;
    busMap: Record<string, any>;
  }> {
   function normalize<T>(input: T[] | { data: T[] } | null | undefined): T[] {
        if (Array.isArray(input)) return input;
        return input?.data ?? [];
    }

    const driversArr = normalize(drivers);
    const conductorsArr = normalize(conductors);
    const busesArr = normalize(buses);

    return {
      driverMap: Object.fromEntries(driversArr.map((d: any) => [d.employeeNumber ?? d.driver_id, d])),
      conductorMap: Object.fromEntries(conductorsArr.map((c: any) => [c.employeeNumber ?? c.conductor_id, c])),
      busMap: Object.fromEntries(busesArr.map((b: any) => [b.id ?? b.bus_id ?? b.busId, b])),
    };
  }

  private formatEmployeeData(employee: any, type: 'driver' | 'conductor'): any {
    if (!employee) return null;

    const idField = type === 'driver' ? 'driver_id' : 'conductor_id';
    return {
      employee_id: employee.employeeNumber ?? employee[idField],
      employee_firstName: employee.firstName ?? employee.name?.split(' ')[0] ?? null,
      employee_middleName: employee.middleName ?? null,
      employee_lastName: employee.lastName ?? employee.name?.split(' ')[1] ?? null,
      employee_suffix: employee.suffix ?? null,
    };
  }

  private findQuotaPolicy(quotaPolicies: any[], dispatchedAt: Date | null): any {
    if (!dispatchedAt) return null;

    return quotaPolicies.find(
      qp =>
        qp.StartDate &&
        qp.EndDate &&
        dispatchedAt >= qp.StartDate &&
        dispatchedAt <= qp.EndDate
    );
  }

  private determineAssignmentType(quotaPolicy: any): { type: string; value: any } {
    if (quotaPolicy?.Fixed) {
      return { type: 'BOUNDARY', value: quotaPolicy.Fixed.Quota };
    }
    if (quotaPolicy?.Percentage) {
      return { type: 'PERCENTAGE', value: quotaPolicy.Percentage.Percentage };
    }
    return { type: 'BUS RENTAL', value: null };
  }

  async getAssignmentSummary(filterBy: string | null): Promise<any[]> {
    const tripConditions = this.buildTripConditions(filterBy);

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

    // Fetch external data
    const [drivers, conductors, buses] = await Promise.all([
      fetchNewDrivers().catch(() => []),
      fetchNewConductors().catch(() => []),
      fetchNewBuses().catch(() => []),
    ]);

    const { driverMap, conductorMap, busMap } = await this.buildLookupMaps(drivers, conductors, buses);

    // Flatten and format results
    const result = assignments.flatMap(a => {
      const busTrips = a.RegularBusAssignment?.BusTrips || [];
      const quotaPolicies = a.RegularBusAssignment?.QuotaPolicies || [];

      const driver = driverMap[a.RegularBusAssignment?.DriverID ?? ''];
      const conductor = conductorMap[a.RegularBusAssignment?.ConductorID ?? ''];
      const bus = busMap[a.BusID ?? ''];

      return busTrips.map(trip => {
        const quotaPolicy = this.findQuotaPolicy(quotaPolicies, trip.DispatchedAt);
        const { type: assignment_type, value: assignment_value } = this.determineAssignmentType(quotaPolicy);

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
          employee_driver: this.formatEmployeeData(driver, 'driver'),
          employee_conductor: this.formatEmployeeData(conductor, 'conductor'),
          bus_id: bus?.id ?? null,
          bus_plate_number: bus?.plate_number ?? bus?.license_plate ?? null,
          bus_type: bus?.bus_type ?? bus?.type ?? null,
          body_number: bus?.body_number ?? null,
        };
      });
    });

    return result;
  }

  async updateBusTrips(updates: any[], actor: string | null): Promise<{ updated: any[]; failed: any[] }> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('No valid bus_trip_id values found');
    }

    const results = await Promise.allSettled(
      updates.map(item => {
        const updateData: Record<string, any> = {
          UpdatedBy: actor,
        };

        if ('IsRevenueRecorded' in item && typeof item.IsRevenueRecorded === 'boolean') {
          updateData.IsRevenueRecorded = item.IsRevenueRecorded;
        }

        if ('IsExpenseRecorded' in item && typeof item.IsExpenseRecorded === 'boolean') {
          updateData.IsExpenseRecorded = item.IsExpenseRecorded;
        }

        if (Object.keys(updateData).length <= 1) {
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
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value);

    const failed = results
      .map((r, i) => ({ result: r, id: updates[i]?.bus_trip_id }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, id }) => ({
        bus_trip_id: id,
        reason: (result as PromiseRejectedResult).reason?.message || 'Update failed',
      }));

    return { updated, failed };
  }
}