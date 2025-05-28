import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
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
      },
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Failed to fetch route summary:', error);
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
        },
      }),
      ...stopIdsWithRouteStopIDs.map(stop =>
        prisma.routeStop.create({ data: stop })
      )
    ]);

    return NextResponse.json(newRoute, { status: 201 });

  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Duplicate stops are not allowed in a route.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 });
  }
}