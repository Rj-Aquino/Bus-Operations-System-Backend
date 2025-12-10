import prisma from '@/client';
import { BusOperationStatus } from '@prisma/client';
import { delCache, CACHE_KEYS } from '@/lib/cache';

const CACHE_KEYS_TO_CLEAR = [CACHE_KEYS.DASHBOARD ?? ''];

export class DashboardService {
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

  private buildDailyEarnings(trips: any[], daysInMonth: number): number[] {
    const dailyEarnings = Array(daysInMonth).fill(0);

    for (const trip of trips) {
      if (trip.DispatchedAt && typeof trip.Sales === 'number') {
        const day = trip.DispatchedAt.getDate();
        dailyEarnings[day - 1] += trip.Sales;
      }
    }

    return dailyEarnings;
  }

  async getEarningsCurrentMonth(): Promise<{
    month: number;
    year: number;
    data: number[];
    previous: {
      month: number;
      year: number;
      data: number[];
    };
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

    const dailyEarnings = this.buildDailyEarnings(busTrips, daysInMonth);

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

    const prevDailyEarnings = this.buildDailyEarnings(prevBusTrips, daysInPrevMonth);

    return {
      month,
      year,
      data: dailyEarnings,
      previous: {
        month: prevMonth,
        year: prevYear,
        data: prevDailyEarnings,
      },
    };
  }

  async getBusStatus(): Promise<Record<string, number>> {
    const statuses = [
      BusOperationStatus.NotStarted,
      BusOperationStatus.NotReady,
      BusOperationStatus.InOperation,
    ];

    const statusCounts: Record<string, number> = {};

    await Promise.all(
      statuses.map(async status => {
        statusCounts[status] = await prisma.busAssignment.count({
          where: { Status: status, IsDeleted: false },
        });
      })
    );

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

    // Aggregate earnings per route for the current month
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
        topRoutes[routeName] += trip.Sales;
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
    await Promise.all(CACHE_KEYS_TO_CLEAR.map(key => delCache(key)));
  }
}