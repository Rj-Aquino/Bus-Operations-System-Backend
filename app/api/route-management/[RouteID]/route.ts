import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { delCache, CACHE_KEYS } from '@/lib/cache';

const ROUTES_CACHE_KEY = CACHE_KEYS.ROUTES ?? '';
const ROUTES_CACHE_KEY_FULL = CACHE_KEYS.ROUTES_FULL ?? '';

type RouteStopInput = {
  StopID: string | { StopID: string };
  StopOrder: number;
};

const putHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const RouteID = url.pathname.split('/').pop();

    if (!RouteID) {
      return NextResponse.json({ error: 'RouteID is required in the URL path.' }, { status: 400 });
    }

    const data = await request.json();
    const { RouteName, StartStopID, EndStopID, RouteStops } = data;

    if (StartStopID === EndStopID) {
      return NextResponse.json(
        { error: 'StartStop and EndStop cannot be the same.' },
        { status: 400 }
      );
    }

    const rawRouteStops: RouteStopInput[] = Array.isArray(RouteStops) ? RouteStops : [];

    const stopIdSet = new Set<string>();
    const normalizedStops: { StopID: string; StopOrder: number }[] = [];

    for (const stop of rawRouteStops) {
      const stopId = typeof stop.StopID === 'string' ? stop.StopID : stop.StopID?.StopID;
      if (!stopId || stopIdSet.has(stopId)) {
        return NextResponse.json(
          { error: 'No duplicate stops allowed in the RouteStops list.' },
          { status: 400 }
        );
      }
      stopIdSet.add(stopId);
      normalizedStops.push({ StopID: stopId, StopOrder: stop.StopOrder });
    }

    const startAndEndSet = new Set([StartStopID, EndStopID]);
    const overlaps = Array.from(startAndEndSet).filter(id => stopIdSet.has(id));
    if (overlaps.length > 0) {
      return NextResponse.json(
        { error: 'StartStop and EndStop should not be included in RouteStops list.' },
        { status: 400 }
      );
    }

    const existingRoute = await prisma.route.findUnique({ where: { RouteID } });

    if (!existingRoute) {
      return NextResponse.json({ error: 'Route not found.' }, { status: 404 });
    }

    const updatedRoute = await prisma.route.update({
      where: { RouteID },
      data: {
        RouteName: RouteName ?? existingRoute.RouteName,
        StartStopID: StartStopID ?? existingRoute.StartStopID,
        EndStopID: EndStopID ?? existingRoute.EndStopID,
        UpdatedBy: user?.employeeId || null,
      },
      select: {
        RouteID: true,
        RouteName: true,
        StartStopID: true,
        EndStopID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
      },
    });

    // Clear existing stops for the route
    await prisma.routeStop.deleteMany({ where: { RouteID } });

    if (normalizedStops.length > 0) {
      const stopsWithIDs = await Promise.all(
        normalizedStops.map(async stop => ({
          ...stop,
          RouteStopID: await generateFormattedID('RTS'),
        }))
      );

      await prisma.$transaction(
        stopsWithIDs.map(stop =>
          prisma.routeStop.create({
            data: {
              RouteStopID: stop.RouteStopID,
              RouteID,
              StopID: stop.StopID,
              StopOrder: stop.StopOrder,
            },
          })
        )
      );
    }

    // Invalidate both summary and full route caches
    await delCache(ROUTES_CACHE_KEY);
    await delCache(ROUTES_CACHE_KEY_FULL);
    await delCache(CACHE_KEYS.DASHBOARD ?? '');

    return NextResponse.json(updatedRoute, { status: 200 });

  } catch (error: any) {
    if (
      error?.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes('RouteID') &&
      error.meta.target.includes('StopID')
    ) {
      return NextResponse.json(
        { error: 'No stops can be duplicated in a route.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
};

const patchHandler = async (req: NextRequest) => {
  const { user, error, status } = await authenticateRequest(req);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(req.url);
    const RouteID = url.pathname.split('/').pop();

    if (!RouteID) {
      return NextResponse.json(
        { error: 'RouteID is required in the URL path.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { IsDeleted } = body;

    if (typeof IsDeleted !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid isDeleted value. It must be a boolean.' },
        { status: 400 }
      );
    }

    const updatedRoute = await prisma.route.update({
      where: { RouteID },
      data: { IsDeleted: IsDeleted, UpdatedBy: user?.employeeId || null },
      select: {
        RouteID: true,
        RouteName: true,
        IsDeleted: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
      },
    });

    await delCache(ROUTES_CACHE_KEY);
    await delCache(ROUTES_CACHE_KEY_FULL);
    await delCache(CACHE_KEYS.DASHBOARD ?? '');

    return NextResponse.json(updatedRoute, { status: 200 });

  } catch (error) {
    console.error('PATCH /route error:', error);
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
};

export const PUT = withCors(putHandler);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));