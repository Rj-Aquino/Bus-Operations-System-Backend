import prisma from '@/client';
import { BusOperationStatus, AssignmentType, RentalRequestStatus } from '@prisma/client';
import { delCache, CACHE_KEYS } from '@/lib/cache';

export class DashboardService {
  private readonly CACHE_KEYS_TO_CLEAR = [CACHE_KEYS.DASHBOARD ?? ''];
  private getMonthRange(month: number, year: number): { start: Date; end: Date } {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private getPreviousMonthYear(month: number, year: number): { month: number; year: number } {
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    return { month: prevMonth, year: prevYear };
  }

  private buildDailyEarnings(trips: any[], rentals: any[], daysInMonth: number): number[] {
    const dailyEarnings = Array(daysInMonth).fill(0);

    for (const trip of trips) {
      if (trip.DispatchedAt && typeof trip.Sales === 'number') {
        const day = trip.DispatchedAt.getDate();
        dailyEarnings[day - 1] += trip.Sales;
      }
    }

    for (const rental of rentals) {
      if (rental.RentalDate && typeof rental.TotalRentalAmount === 'number') {
        const day = new Date(rental.RentalDate).getDate();
        dailyEarnings[day - 1] += rental.TotalRentalAmount;
      }
    }

    return dailyEarnings;
  }

  async getEarningsCurrentMonth(): Promise<{
    operations: { month: number; year: number; data: number[]; previous: { month: number; year: number; data: number[] } };
    rentals: { month: number; year: number; data: number[]; previous: { month: number; year: number; data: number[] } };
  }> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Current month
    const { start: startOfMonth, end: endOfMonth } = this.getMonthRange(month, year);
    const daysInMonth = new Date(year, month, 0).getDate();

    const busTrips = await prisma.busTrip.findMany({
      where: {
        DispatchedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: {
        DispatchedAt: true,
        Sales: true,
      },
    });

    const rentals = await prisma.rentalRequest.findMany({
      where: {
        RentalDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        IsDeleted: false,
        // include completed and paid rentals if needed - using all for now
      },
      select: {
        RentalDate: true,
        TotalRentalAmount: true,
        RouteName: true,
      },
    });

    // operations (bus trips) earnings
    const operationsDaily = this.buildDailyEarnings(busTrips, [], daysInMonth);

    // rentals earnings
    const rentalsDaily = this.buildDailyEarnings([], rentals, daysInMonth);

    // Previous month
    const { month: prevMonth, year: prevYear } = this.getPreviousMonthYear(month, year);
    const { start: startOfPrevMonth, end: endOfPrevMonth } = this.getMonthRange(prevMonth, prevYear);
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

    const prevBusTrips = await prisma.busTrip.findMany({
      where: {
        DispatchedAt: {
          gte: startOfPrevMonth,
          lte: endOfPrevMonth,
        },
      },
      select: {
        DispatchedAt: true,
        Sales: true,
      },
    });

    const prevRentals = await prisma.rentalRequest.findMany({
      where: {
        RentalDate: {
          gte: startOfPrevMonth,
          lte: endOfPrevMonth,
        },
        IsDeleted: false,
      },
      select: {
        RentalDate: true,
        TotalRentalAmount: true,
      },
    });

    const prevOperationsDaily = this.buildDailyEarnings(prevBusTrips, [], daysInPrevMonth);
    const prevRentalsDaily = this.buildDailyEarnings([], prevRentals, daysInPrevMonth);

    return {
      operations: {
        month,
        year,
        data: operationsDaily,
        previous: { month: prevMonth, year: prevYear, data: prevOperationsDaily },
      },
      rentals: {
        month,
        year,
        data: rentalsDaily,
        previous: { month: prevMonth, year: prevYear, data: prevRentalsDaily },
      },
    };
  }

  async getBusStatus(): Promise<Record<string, number>> {
    const baseStatuses: any[] = [
      BusOperationStatus.NotStarted,
      BusOperationStatus.NotReady,
      BusOperationStatus.InOperation,
    ];

    const statusCounts: Record<string, number> = {};

    await Promise.all(
      baseStatuses.map(async status => {
        const statusKey = String(status);
        if (status === BusOperationStatus.InOperation) {
          // Count only regular (non-rental) assignments in InOperation
          statusCounts[statusKey] = await prisma.busAssignment.count({
            where: {
              Status: BusOperationStatus.InOperation,
              IsDeleted: false,
              AssignmentType: AssignmentType.Regular,
            },
          });
        } else {
          statusCounts[statusKey] = await prisma.busAssignment.count({ where: { Status: status as any, IsDeleted: false } });
        }
      })
    );

    // Count InRental = BusAssignment in InOperation AND has at least one Approved RentalRequest
    statusCounts['InRental'] = await prisma.busAssignment.count({
      where: {
        Status: BusOperationStatus.InOperation,
        IsDeleted: false,
        RentalBusAssignment: {
          RentalRequests: {
            some: {
              Status: RentalRequestStatus.Approved,
              IsDeleted: false,
            },
          },
        },
      },
    });

    return statusCounts;
  }

  async getTopPerformingRoutes(): Promise<Record<string, number>> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const { start: startOfMonth, end: endOfMonth } = this.getMonthRange(month, year);

    // Get all non-deleted routes
    const allRoutes = await prisma.route.findMany({
      where: { IsDeleted: false },
      select: { RouteName: true },
    });

    const topRoutes: Record<string, number> = {};
    for (const route of allRoutes) {
      topRoutes[route.RouteName] = 0;
    }

    // Aggregate earnings per route for the current month - bus trips
    const tripsWithRoute = await prisma.busTrip.findMany({
      where: {
        DispatchedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: {
        Sales: true,
        regularBusAssignment: {
          select: {
            BusAssignment: {
              select: {
                Route: {
                  select: {
                    RouteName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const trip of tripsWithRoute) {
      const routeName = trip.regularBusAssignment?.BusAssignment?.Route?.RouteName;
      if (routeName && typeof trip.Sales === 'number') {
        topRoutes[routeName] = (topRoutes[routeName] || 0) + trip.Sales;
      }
    }

    // Aggregate rental earnings by RouteName for the current month
    const rentalEarnings = await prisma.rentalRequest.findMany({
      where: {
        RentalDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        IsDeleted: false,
      },
      select: {
        RouteName: true,
        TotalRentalAmount: true,
      },
    });

    for (const rent of rentalEarnings) {
      const routeName = rent.RouteName;
      if (routeName && typeof rent.TotalRentalAmount === 'number') {
        topRoutes[routeName] = (topRoutes[routeName] || 0) + rent.TotalRentalAmount;
      }
    }

    return topRoutes;
  }

  async getDashboardData(): Promise<any> {
    const [earnings, busStatus, topRoutes] = await Promise.all([
      this.getEarningsCurrentMonth(),
      this.getBusStatus(),
      this.getTopPerformingRoutes(),
    ]);

    return {
      earnings,
      busStatus,
      topRoutes,
    };
  }

  private async clearCache(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_CLEAR.filter(key => key).map(key => delCache(key)));
  }
}
