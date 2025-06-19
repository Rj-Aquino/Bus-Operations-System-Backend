import { NextRequest, NextResponse } from 'next/server';
import { BusOperationStatus } from '@prisma/client';
import { withCors } from '@/lib/withcors';
import { authenticateRequest } from '@/lib/auth';
import prisma from '@/client';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

const DASHBOARD_CACHE_KEY = CACHE_KEYS.DASHBOARD ?? '';

const getDashboardHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache(DASHBOARD_CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { status: 200 });
  }

  // Get current month and year
  const now = new Date();
  const month = now.getMonth() + 1; // JS months are 0-based
  const year = now.getFullYear();

  // 1. Bus Earnings (for the current month)
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

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

  // Prepare daily earnings array
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyEarnings = Array(daysInMonth).fill(0);

  for (const trip of busTrips) {
    if (trip.DispatchedAt && typeof trip.Sales === 'number') {
      const day = trip.DispatchedAt.getDate();
      dailyEarnings[day - 1] += trip.Sales;
    }
  }

  // 2. Bus Status - count by all statuses
  const statuses = [
    BusOperationStatus.NotStarted,
    BusOperationStatus.NotReady,
    BusOperationStatus.InOperation,
  ];
  const statusCounts: Record<string, number> = {};
  await Promise.all(
    statuses.map(async (status) => {
      statusCounts[status] = await prisma.busAssignment.count({
        where: { Status: status, IsDeleted: false },
      });
    })
  );

  // 3. Top Performing Routes (by earnings for the month)
  // First, get all routes
  const allRoutes = await prisma.route.findMany({
    where: { IsDeleted: false },
    select: { RouteName: true },
  });

  // Prepare initial topRoutes with all route names set to 0
  const topRoutes: Record<string, number> = {};
  for (const route of allRoutes) {
    topRoutes[route.RouteName] = 0;
  }

  // Now, aggregate earnings per route for the month
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

  const responseData = {
    earnings: { month, year, data: dailyEarnings },
    busStatus: statusCounts,
    topRoutes,
  };

  await setCache(DASHBOARD_CACHE_KEY, responseData);

  return NextResponse.json(responseData);
};

export const GET = withCors(getDashboardHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));