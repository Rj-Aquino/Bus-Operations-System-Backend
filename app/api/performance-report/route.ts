import { NextRequest, NextResponse } from "next/server";
import prisma from "@/client";
import { fetchNewDrivers, fetchNewConductors, fetchNewBuses } from "@/lib/fetchExternal";
import { authenticateRequest } from "@/lib/auth";
import { withCors } from "@/lib/withcors";

export const getHandler = async (request: NextRequest) => {
  // === Authentication ===
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    // === Query params for filters ===
    const { searchParams } = new URL(request.url);
    const dateRange = Number(searchParams.get("days")) || 30; // 7, 30, 90
    const busTypeFilter = searchParams.get("busType") || "all"; // "Aircon", "Non-Aircon", "all"
    const routeFilter = searchParams.get("route") || "all"; // specific route name or "all"

    // === Date Range ===
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - dateRange);
    const prevEnd = new Date(endDate);
    prevEnd.setDate(prevEnd.getDate() - dateRange);

    // === Reference Data ===
    const [drivers, conductors, buses] = await Promise.all([
      fetchNewDrivers(),
      fetchNewConductors(),
      fetchNewBuses(),
    ]);

    // === Build lookup maps ===
    const driverMap = Object.fromEntries(
      drivers.map((d: any) => [
        d.employeeNumber,
        `${d.firstName} ${d.middleName ? d.middleName[0] + ". " : ""}${d.lastName}`,
      ])
    );

    const conductorMap = Object.fromEntries(
      conductors.map((c: any) => [
        c.employeeNumber,
        `${c.firstName} ${c.middleName ? c.middleName[0] + ". " : ""}${c.lastName}`,
      ])
    );

    const busMap = Object.fromEntries(buses.map((b: any) => [b.bus_id, b.bus_type]));

    // === Helper: Build Prisma filter for dates & route only ===
    const buildTripFilter = (start: Date, end: Date) => ({
      DispatchedAt: { gte: start, lte: end },
      regularBusAssignment: {
        BusAssignment: {
          include: { Route: true },
        },
      },
    });

    // === Fetch Current & Previous Trips (without BusType) ===
    const [currentTripsRaw, previousTripsRaw] = await Promise.all([
      prisma.busTrip.findMany({
        where: {
          DispatchedAt: { gte: startDate, lte: endDate },
        },
        include: { regularBusAssignment: { include: { BusAssignment: { include: { Route: true } } } } },
      }),
      prisma.busTrip.findMany({
        where: {
          DispatchedAt: { gte: prevStart, lte: prevEnd },
        },
        include: { regularBusAssignment: { include: { BusAssignment: { include: { Route: true } } } } },
      }),
    ]);

    // === Filter trips by BusType and Route ===
    const filterTrips = (trips: typeof currentTripsRaw) =>
      trips.filter((t) => {
        const busId = t.regularBusAssignment?.BusAssignment?.BusID;
        const routeName = t.regularBusAssignment?.BusAssignment?.Route?.RouteName ?? "Unknown";

        const busTypeMatch = busTypeFilter === "all" || busMap[busId] === busTypeFilter;
        const routeMatch = routeFilter === "all" || routeName === routeFilter;

        return t.regularBusAssignment?.DriverID && t.regularBusAssignment?.ConductorID && busTypeMatch && routeMatch;
      });

    const currentTrips = filterTrips(currentTripsRaw);
    const previousTrips = filterTrips(previousTripsRaw);

    // === Aggregate Metrics ===
    const totalTrips = currentTrips.length;
    const totalRevenue = currentTrips.reduce((sum, t) => sum + (t.Sales ?? 0), 0);
    const avgRevenuePerTrip = totalTrips > 0 ? totalRevenue / totalTrips : 0;

    const prevRevenue = previousTrips.reduce((sum, t) => sum + (t.Sales ?? 0), 0);
    const prevTripCount = previousTrips.length;

    const revenueGrowth =
      prevRevenue === 0 ? "New" : `${(((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)}%`;
    const tripGrowth =
      prevTripCount === 0 ? "New" : `${(((totalTrips - prevTripCount) / prevTripCount) * 100).toFixed(1)}%`;

    // === Route Stats ===
    const routeStats: Record<string, { trips: number; revenue: number }> = {};
    for (const trip of currentTrips) {
      const routeName = trip.regularBusAssignment.BusAssignment?.Route?.RouteName ?? "Unknown";
      if (!routeStats[routeName]) routeStats[routeName] = { trips: 0, revenue: 0 };
      routeStats[routeName].trips++;
      routeStats[routeName].revenue += trip.Sales ?? 0;
    }

    const sortedRoutes = Object.entries(routeStats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    const dynamicSlice = (items: any[]) => {
      const count = Math.max(1, Math.floor(items.length / 2));
      const top = items.slice(0, count);
      let low = items.slice(-count).filter((l) => !top.find((t) => t.name === l.name));
      if (low.length === 0 && items.length > top.length) low = items.slice(top.length);
      return { top, low };
    };

    const { top: topRoutes, low: lowRoutes } = dynamicSlice(sortedRoutes);

    // === Driver / Conductor / Team Stats ===
    const driverStats: Record<string, { trips: number; revenue: number }> = {};
    const conductorStats: Record<string, { trips: number; revenue: number }> = {};
    const teamStats: Record<string, { driver: string; conductor: string; trips: number; revenue: number }> = {};

    for (const trip of currentTrips) {
      const { DriverID, ConductorID } = trip.regularBusAssignment!;
      const driver = driverMap[DriverID] || `Driver ${DriverID}`;
      const conductor = conductorMap[ConductorID] || `Conductor ${ConductorID}`;
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

    const getDynamicTopLow = (stats: Record<string, { trips: number; revenue: number }>) => {
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
      let low = sorted.slice(-count).filter((l) => !top.find((t) => t.name === l.name));
      if (low.length === 0 && sorted.length > top.length) low = sorted.slice(top.length);
      return { top, low, all: sorted };
    };

    const { top: topDrivers, low: lowDrivers } = getDynamicTopLow(driverStats);
    const { top: topConductors, low: lowConductors } = getDynamicTopLow(conductorStats);

    const topTeams = Object.values(teamStats).sort((a, b) => b.revenue - a.revenue).slice(0, 3);

    // Revenue by Route
    const revenueByRoute = sortedRoutes.map((route) => ({ route: route.name, revenue: route.revenue }));

    // Monthly Trends
    const monthlyMap: Record<string, { revenue: number; trips: number }> = {};
    currentTrips.forEach((trip) => {
      if (trip.DispatchedAt) {
        const month = trip.DispatchedAt.toLocaleString("en-US", { month: "short" });
        if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, trips: 0 };
        monthlyMap[month].revenue += trip.Sales ?? 0;
        monthlyMap[month].trips += 1;
      }
    });
    const monthlyTrends = Object.entries(monthlyMap)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => new Date(`1 ${a.month} 2000`).getTime() - new Date(`1 ${b.month} 2000`).getTime());

    return NextResponse.json({
      overview: {
        totalTrips,
        totalRevenue,
        avgRevenuePerTrip,
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
    });
  } catch (error) {
    console.error("Performance Report Error:", error);
    return NextResponse.json({ error: "Failed to generate performance report" }, { status: 500 });
  }
};

// === Export with CORS ===
export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
