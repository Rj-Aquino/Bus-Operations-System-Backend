import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, delCache } from '@/lib/cache';

const ROUTES_CACHE_KEY = 'routes_list';
const TTL_SECONDS = 60 * 60; // 1 hour

type RouteStopInput = {
  StopID: string | { StopID: string };
  StopOrder: number;
};

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache<any[]>(ROUTES_CACHE_KEY);
  if (cached) {
    // Apply UpdatedAt/UpdatedBy logic to cached data
    const processed = cached.map(item => {
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });
    return NextResponse.json(processed);
  }

  try {
    const routes = await prisma.route.findMany({
      where: {
        IsDeleted: false,
      },
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        RouteID: true,
        RouteName: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        StartStop: {
          select: {
            StopName: true,
          },
        },
        EndStop: {
          select: {
            StopName: true,
          },
        },
      },
    });

    // Apply UpdatedAt/UpdatedBy logic before caching and returning
    const processed = routes.map(item => {
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });

    await setCache(ROUTES_CACHE_KEY, processed, TTL_SECONDS);
    return NextResponse.json(processed);
  } catch (error) {
    console.error('Failed to fetch route summary:', error);
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
};

const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const data = await request.json();
    const rawRouteStops: RouteStopInput[] = Array.isArray(data.RouteStops) ? data.RouteStops : [];

    if (data.StartStopID === data.EndStopID) {
      return NextResponse.json({ error: 'StartStop and EndStop cannot be the same.' }, { status: 400 });
    }

    const startAndEndSet = new Set([data.StartStopID, data.EndStopID]);
    const stopIDList = rawRouteStops.map((stop) =>
      typeof stop.StopID === 'string' ? stop.StopID : stop.StopID?.StopID
    );

    const overlaps = stopIDList.filter((id) => startAndEndSet.has(id));
    if (overlaps.length > 0) {
      return NextResponse.json(
        { error: 'StartStop and EndStop should not be included in RouteStops.' },
        { status: 400 }
      );
    }

    const newRouteID = await generateFormattedID('RT');

    const stopIdsWithRouteStopIDs = await Promise.all(
      rawRouteStops.map(async (stop) => {
        const stopId = typeof stop.StopID === 'string' ? stop.StopID : stop.StopID?.StopID;
        return {
          RouteStopID: await generateFormattedID('RTS'),
          RouteID: newRouteID,
          StopID: stopId,
          StopOrder: stop.StopOrder,
        };
      })
    );

    const [newRoute] = await prisma.$transaction([
      prisma.route.create({
        data: {
          RouteID: newRouteID,
          RouteName: data.RouteName,
          StartStopID: data.StartStopID,
          EndStopID: data.EndStopID,
          IsDeleted: false,
          CreatedBy: user?.employeeId || null,
          UpdatedBy: null, // Only set CreatedBy on creation
        },
        select: {
          RouteID: true,
          RouteName: true,
          CreatedAt: true,
          UpdatedAt: true,
          CreatedBy: true,
          UpdatedBy: true,
          StartStop: { select: { StopName: true } },
          EndStop: { select: { StopName: true } },
        },
      }),
      ...stopIdsWithRouteStopIDs.map(stop =>
        prisma.routeStop.create({ data: stop })
      )
    ]);

    await delCache(ROUTES_CACHE_KEY);
    return NextResponse.json({
      ...newRoute,
      // Apply UpdatedAt/UpdatedBy logic for immediate response
      ...(newRoute.CreatedAt && newRoute.UpdatedAt &&
        new Date(newRoute.CreatedAt).getTime() === new Date(newRoute.UpdatedAt).getTime()
        ? { UpdatedAt: null, UpdatedBy: null }
        : {}),
    }, { status: 201 });

  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Duplicate stops are not allowed in a route.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));