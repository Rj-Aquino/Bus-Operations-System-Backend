import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Adjust the import path based on your setup
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { generateFormattedID } from '../../../lib/idGenerator';

export async function GET() {
  try {
    const routes = await prisma.route.findMany({
      where: {
        IsDeleted: false, // Only include non-deleted routes
      },
      include: {
        StartStop: true,
        EndStop: true,
        RouteStops: {
          include: {
            Stop: {
              select: {
                StopName: true, // Only include StopName for RouteStops
              },
            },
          },
        },
      },
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
}

type RouteStopInput = {
  StopID: string | { StopID: string };
  StopOrder: number;
};

export async function POST(req: Request) {
  try {
    console.log('POST request received for creating a new route');

    const data = await req.json();
    console.log('Data received in API:', data);

    const rawRouteStops: RouteStopInput[] = Array.isArray(data.RouteStops) ? data.RouteStops : [];

    // Normalize StopIDs
    const routeStopIds = rawRouteStops.map(routeStop =>
      typeof routeStop.StopID === 'string' ? routeStop.StopID : routeStop.StopID?.StopID
    );

    // Check for duplicate StopIDs in RouteStops
    const uniqueStopIds = new Set(routeStopIds);
    if (uniqueStopIds.size !== routeStopIds.length) {
      return NextResponse.json(
        { error: 'No duplicate stops allowed in the RouteStops list.' },
        { status: 400 }
      );
    }

    // Check StartStopID and EndStopID are different
    if (data.StartStopID === data.EndStopID) {
      return NextResponse.json(
        { error: 'StartStop and EndStop cannot be the same.' },
        { status: 400 }
      );
    }

    // Check if StartStopID or EndStopID is included in RouteStops
    if (uniqueStopIds.has(data.StartStopID)) {
      return NextResponse.json(
        { error: 'StartStop should not be included in RouteStops list.' },
        { status: 400 }
      );
    }
    if (uniqueStopIds.has(data.EndStopID)) {
      return NextResponse.json(
        { error: 'EndStop should not be included in RouteStops list.' },
        { status: 400 }
      );
    }

    // Create the Route
    const newRouteID = await generateFormattedID('RT');
    console.log('Generated new RouteID:', newRouteID);

    const newRoute = await prisma.route.create({
      data: {
        RouteID: newRouteID,
        RouteName: data.RouteName,
        StartStopID: data.StartStopID,
        EndStopID: data.EndStopID,
        IsDeleted: false,
      },
    });
    console.log('New Route created:', newRoute);

    // Create RouteStops
    if (routeStopIds.length > 0) {
      const createdRouteStops = await Promise.all(
        rawRouteStops.map(async (routeStop) => {
          const stopIdValue = typeof routeStop.StopID === 'string'
            ? routeStop.StopID
            : routeStop.StopID?.StopID;

          const RouteStopID = await generateFormattedID('RTS');

          return prisma.routeStop.create({
            data: {
              RouteStopID,
              RouteID: newRouteID,
              StopID: stopIdValue,
              StopOrder: routeStop.StopOrder,
            },
          });
        })
      );
      console.log('Created RouteStops:', createdRouteStops);
    } else {
      console.log('No RouteStops provided, skipping creation.');
    }

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

    console.error('Error creating route:', error);
    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 });
  }
}