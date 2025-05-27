import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Adjust the import path based on your setup
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { generateFormattedID } from '../../../lib/idGenerator';

export async function GET() {
  try {
    const routes = await prisma.route.findMany({
      where: {
        IsDeleted: false,
      },
      select: {
        RouteID: true,
        RouteName: true,
        StartStop: {
          select: {
            StopID: true,
            StopName: true,
          },
        },
        EndStop: {
          select: {
            StopID: true,
            StopName: true,
          },
        },
        RouteStops: {
          select: {
            StopOrder: true,
            Stop: {
              select: {
                StopName: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Failed to fetch routes:', error);
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
}

type RouteStopInput = {
  StopID: string | { StopID: string };
  StopOrder: number;
};

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const rawRouteStops: RouteStopInput[] = Array.isArray(data.RouteStops) ? data.RouteStops : [];

    // Normalize and validate StopIDs
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

    if (data.StartStopID === data.EndStopID) {
      return NextResponse.json(
        { error: 'StartStop and EndStop cannot be the same.' },
        { status: 400 }
      );
    }

    if (stopIdSet.has(data.StartStopID)) {
      return NextResponse.json(
        { error: 'StartStop should not be included in RouteStops list.' },
        { status: 400 }
      );
    }

    if (stopIdSet.has(data.EndStopID)) {
      return NextResponse.json(
        { error: 'EndStop should not be included in RouteStops list.' },
        { status: 400 }
      );
    }

    const newRouteID = await generateFormattedID('RT');

    // Pre-generate RouteStopIDs (not awaited, just values)
    const stopIdsWithRouteStopIDs = await Promise.all(
      normalizedStops.map(async stop => ({
        ...stop,
        RouteStopID: await generateFormattedID('RTS')
      }))
    );

    // Prepare Prisma transaction queries (PrismaPromises)
    const queries = [
      prisma.route.create({
        data: {
          RouteID: newRouteID,
          RouteName: data.RouteName,
          StartStopID: data.StartStopID,
          EndStopID: data.EndStopID,
          IsDeleted: false,
        },
      }),
      ...stopIdsWithRouteStopIDs.map(stop =>
        prisma.routeStop.create({
          data: {
            RouteStopID: stop.RouteStopID,
            RouteID: newRouteID,
            StopID: stop.StopID,
            StopOrder: stop.StopOrder,
          },
        })
      )
    ];

    const [newRoute] = await prisma.$transaction(queries);

    return NextResponse.json(newRoute, { status: 201 });

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

    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 });
  }
}
