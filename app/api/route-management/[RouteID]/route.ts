import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Adjust the import path based on your setup
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { generateFormattedID } from '../../../../lib/idGenerator';

type RouteStopInput = {
  StopID: string | { StopID: string };
  StopOrder: number;
};

export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const RouteID = url.pathname.split('/').pop();

    if (!RouteID) {
      return NextResponse.json({ error: 'RouteID is required in the URL path.' }, { status: 400 });
    }

    const data = await request.json();
    const { RouteName, StartStopID, EndStopID, RouteStops, IsDeleted } = data;

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
        { error: 'StartStopID and EndStopID should not be included in RouteStops list.' },
        { status: 400 }
      );
    }

    // Soft delete shortcut
    if (IsDeleted === true) {
      const softDeletedRoute = await prisma.route.update({
        where: { RouteID },
        data: { IsDeleted: true },
      });
      return NextResponse.json(softDeletedRoute, { status: 200 });
    }

    // Fetch current route
    const existingRoute = await prisma.route.findUnique({ where: { RouteID } });

    if (!existingRoute) {
      return NextResponse.json({ error: 'Route not found.' }, { status: 404 });
    }

    // Update route
    const updatedRoute = await prisma.route.update({
      where: { RouteID },
      data: {
        RouteName: RouteName ?? existingRoute.RouteName,
        StartStopID: StartStopID ?? existingRoute.StartStopID,
        EndStopID: EndStopID ?? existingRoute.EndStopID,
        IsDeleted: existingRoute.IsDeleted,
      },
    });

    // If new RouteStops are provided, replace them
    if (normalizedStops.length > 0) {
      const stopsWithIDs = await Promise.all(
        normalizedStops.map(async stop => ({
          ...stop,
          RouteStopID: await generateFormattedID('RTS'),
        }))
      );

      await prisma.$transaction([
        prisma.routeStop.deleteMany({ where: { RouteID } }),
        ...stopsWithIDs.map(stop =>
          prisma.routeStop.create({
            data: {
              RouteStopID: stop.RouteStopID,
              RouteID,
              StopID: stop.StopID,
              StopOrder: stop.StopOrder,
            },
          })
        ),
      ]);
    }

    return NextResponse.json(updatedRoute, { status: 200 });

  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
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
}

export async function PATCH(req: NextRequest) {
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
      data: { IsDeleted: IsDeleted },
    });

    return NextResponse.json(updatedRoute, { status: 200 });

  } catch (error) {
    console.error('PATCH /route error:', error);
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
}
