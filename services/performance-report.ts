import prisma from '@/client';
import { fetchNewDrivers, fetchNewConductors, fetchNewBuses } from '@/lib/fetchExternal';
import { delCache, CACHE_KEYS } from '@/lib/cache';

// const CACHE_KEYS_TO_CLEAR = [CACHE_KEYS.PERFORMANCE_REPORT ?? ''];

type TripData = {
  Sales?: number | null;
  DispatchedAt?: Date | null;
  regularBusAssignment?: {
    DriverID?: string | null;
    ConductorID?: string | null;
    BusAssignment?: {
      BusID?: string | null;
      Route?: {
        RouteName?: string;
      } | null;
    } | null;
  } | null;
};

export class PerformanceReportService {
  private buildDateRange(days: number): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - days);
    const prevEnd = new Date(endDate);
    prevEnd.setDate(prevEnd.getDate() - days);

    return { start: startDate, end: endDate, prevStart, prevEnd };
  }

  private async buildLookupMaps(
    drivers: any[],
    conductors: any[],
    buses: any[]
  ): Promise<{
    driverMap: Record<string, string>;
    conductorMap: Record<string, string>;
    busMap: Record<string, string>;
  }> {
    const driverMap = Object.fromEntries(
      drivers.map((d: any) => [
        d.employeeNumber,
        `${d.firstName} ${d.middleName ? d.middleName[0] + '. ' : ''}${d.lastName}`,
      ])
    );

    const conductorMap = Object.fromEntries(
      conductors.map((c: any) => [
        c.employeeNumber,
        `${c.firstName} ${c.middleName ? c.middleName[0] + '. ' : ''}${c.lastName}`,
      ])
    );

    const busMap = Object.fromEntries(buses.map((b: any) => [b.bus_id, b.bus_type]));

    return { driverMap, conductorMap, busMap };
  }

  private filterTrips(
    trips: TripData[],
    busMap: Record<string, string>,
    busTypeFilter: string,
    routeFilter: string
  ): TripData[] {
    return trips.filter(t => {
      const busId = t.regularBusAssignment?.BusAssignment?.BusID;
      const routeName = t.regularBusAssignment?.BusAssignment?.Route?.RouteName ?? 'Unknown';

      const busTypeMatch = busTypeFilter === 'all' || busMap[busId ?? ''] === busTypeFilter;
      const routeMatch = routeFilter === 'all' || routeName === routeFilter;

      return (
        t.regularBusAssignment?.DriverID &&
        t.regularBusAssignment?.ConductorID &&
        busTypeMatch &&
        routeMatch
      );
    });
  }

  private calculateGrowth(current: number, previous: number, isCount: boolean = false): string {
    if (previous === 0) return 'New';
    const growth = ((current - previous) / previous) * 100;
    return `${growth.toFixed(1)}%`;
  }

  private buildRouteStats(trips: TripData[]): Record<string, { trips: number; revenue: number }> {
    const routeStats: Record<string, { trips: number; revenue: number }> = {};

    for (const trip of trips) {
      const routeName = trip.regularBusAssignment?.BusAssignment?.Route?.RouteName ?? 'Unknown';
      if (!routeStats[routeName]) routeStats[routeName] = { trips: 0, revenue: 0 };
      routeStats[routeName].trips++;
      routeStats[routeName].revenue += trip.Sales ?? 0;
    }

    return routeStats;
  }

  private dynamicSlice<T extends { name: string }>(items: T[]): { top: T[]; low: T[] } {
    const count = Math.max(1, Math.floor(items.length / 2));
    const top = items.slice(0, count);
    let low = items.slice(-count).filter(l => !top.find(t => t.name === l.name));
    if (low.length === 0 && items.length > top.length) low = items.slice(top.length);
    return { top, low };
  }

  private buildEmployeeStats(
    trips: TripData[],
    driverMap: Record<string, string>,
    conductorMap: Record<string, string>
  ): {
    driverStats: Record<string, { trips: number; revenue: number }>;
    conductorStats: Record<string, { trips: number; revenue: number }>;
    teamStats: Record<string, { driver: string; conductor: string; trips: number; revenue: number }>;
  } {
    const driverStats: Record<string, { trips: number; revenue: number }> = {};
    const conductorStats: Record<string, { trips: number; revenue: number }> = {};
    const teamStats: Record<string, { driver: string; conductor: string; trips: number; revenue: number }> = {};

    for (const trip of trips) {
      const { DriverID, ConductorID } = trip.regularBusAssignment!;
      const driver = driverMap[DriverID ?? ''] || `Driver ${DriverID}`;
      const conductor = conductorMap[ConductorID ?? ''] || `Conductor ${ConductorID}`;
      const key = `${driver}-${conductor}`;
      const revenue = trip.Sales ?? 0;

      if (!driverStats[driver]) driverStats[driver] = { trips: 0, revenue: 0 };
      driverStats[driver].trips++;
      driverStats[driver].revenue += revenue;

      if (!conductorStats[conductor]) conductorStats[conductor] = { trips: 0, revenue: 0 };
      conductorStats[conductor].trips++;
      conductorStats[conductor].revenue += revenue;

      if (!teamStats[key]) teamStats[key] = { driver, conductor, trips: 0, revenue: 0 };
      teamStats[key].trips++;
      teamStats[key].revenue += revenue;
    }

    return { driverStats, conductorStats, teamStats };
  }

  private getDynamicTopLow(stats: Record<string, { trips: number; revenue: number }>) {
    const sorted = Object.entries(stats)
      .map(([name, data]) => ({
        name,
        trips: data.trips,
        revenue: data.revenue,
        avgRevenue: data.trips > 0 ? data.revenue / data.trips : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const count = Math.max(1, Math.floor(sorted.length / 2));
    const top = sorted.slice(0, count);
    let low = sorted.slice(-count).filter(l => !top.find(t => t.name === l.name));
    if (low.length === 0 && sorted.length > top.length) low = sorted.slice(top.length);

    return { top, low, all: sorted };
  }

  private buildMonthlyTrends(trips: TripData[]): Array<{ month: string; revenue: number; trips: number }> {
    const monthlyMap: Record<string, { revenue: number; trips: number }> = {};

    trips.forEach(trip => {
      if (trip.DispatchedAt) {
        const month = trip.DispatchedAt.toLocaleString('en-US', { month: 'short' });
        if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, trips: 0 };
        monthlyMap[month].revenue += trip.Sales ?? 0;
        monthlyMap[month].trips += 1;
      }
    });

    return Object.entries(monthlyMap)
      .map(([month, data]) => ({ month, ...data }))
      .sort(
        (a, b) =>
          new Date(`1 ${a.month} 2000`).getTime() - new Date(`1 ${b.month} 2000`).getTime()
      );
  }

  async getPerformanceReport(
    days: number = 30,
    busType: string = 'all',
    route: string = 'all'
  ): Promise<any> {
    // === Date Range ===
    const { start: startDate, end: endDate, prevStart, prevEnd } = this.buildDateRange(days);

    // === Reference Data ===
    const [drivers, conductors, buses] = await Promise.all([
      fetchNewDrivers().catch(() => []),
      fetchNewConductors().catch(() => []),
      fetchNewBuses().catch(() => []),
    ]);

    const { driverMap, conductorMap, busMap } = await this.buildLookupMaps(drivers, conductors, buses);

    // === Fetch Current & Previous Trips ===
    const [currentTripsRaw, previousTripsRaw] = await Promise.all([
      prisma.busTrip.findMany({
        where: {
          DispatchedAt: { gte: startDate, lte: endDate },
        },
        include: {
          regularBusAssignment: {
            include: {
              BusAssignment: {
                include: { Route: true },
              },
            },
          },
        },
      }),
      prisma.busTrip.findMany({
        where: {
          DispatchedAt: { gte: prevStart, lte: prevEnd },
        },
        include: {
          regularBusAssignment: {
            include: {
              BusAssignment: {
                include: { Route: true },
              },
            },
          },
        },
      }),
    ]);

    // === Filter Trips ===
    const currentTrips = this.filterTrips(currentTripsRaw, busMap, busType, route);
    const previousTrips = this.filterTrips(previousTripsRaw, busMap, busType, route);

    // === Aggregate Metrics ===
    const totalTrips = currentTrips.length;
    const totalRevenue = currentTrips.reduce((sum, t) => sum + (t.Sales ?? 0), 0);
    const avgRevenuePerTrip = totalTrips > 0 ? totalRevenue / totalTrips : 0;

    const prevRevenue = previousTrips.reduce((sum, t) => sum + (t.Sales ?? 0), 0);
    const prevTripCount = previousTrips.length;

    const revenueGrowth = this.calculateGrowth(totalRevenue, prevRevenue);
    const tripGrowth = this.calculateGrowth(totalTrips, prevTripCount, true);

    // === Route Stats ===
    const routeStats = this.buildRouteStats(currentTrips);
    const sortedRoutes = Object.entries(routeStats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    const { top: topRoutes, low: lowRoutes } = this.dynamicSlice(sortedRoutes);

    // === Driver / Conductor / Team Stats ===
    const { driverStats, conductorStats, teamStats } = this.buildEmployeeStats(
      currentTrips,
      driverMap,
      conductorMap
    );

    const { top: topDrivers, low: lowDrivers } = this.getDynamicTopLow(driverStats);
    const { top: topConductors, low: lowConductors } = this.getDynamicTopLow(conductorStats);

    const topTeams = Object.values(teamStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);

    // === Revenue by Route ===
    const revenueByRoute = sortedRoutes.map(route => ({
      route: route.name,
      revenue: route.revenue,
    }));

    // === Monthly Trends ===
    const monthlyTrends = this.buildMonthlyTrends(currentTrips);

    return {
      overview: {
        totalTrips,
        totalRevenue,
        avgRevenuePerTrip: Math.round(avgRevenuePerTrip * 100) / 100,
        activeRoutes: Object.keys(routeStats).length,
        revenueGrowth,
        tripGrowth,
      },
      topRoutes,
      lowRoutes,
      topDrivers,
      lowDrivers,
      topConductors,
      lowConductors,
      topTeams,
      revenueByRoute,
      monthlyTrends,
    };
  }

//   private async clearCache(): Promise<void> {
//     await Promise.all(CACHE_KEYS_TO_CLEAR.map(key => delCache(key)));
//   }
}