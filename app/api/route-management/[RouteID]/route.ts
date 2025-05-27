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
    // Extract RouteID from URL path (last segment)
    const url = new URL(request.url);
    const RouteID = url.pathname.split('/').pop();

    if (!RouteID) {
      return NextResponse.json(
        { error: 'RouteID is required in the URL path.' },
        { status: 400 }
      );
    }

    const data = await request.json();
    const { RouteName, StartStopID, EndStopID, RouteStops, IsDeleted } = data;

    // Validate RouteStops (if present)
    const rawRouteStops: typeof RouteStops = Array.isArray(RouteStops) ? RouteStops : [];

    // Normalize StopIDs
    const routeStopIds = rawRouteStops.map((routeStop: RouteStopInput) =>
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
    if (StartStopID === EndStopID) {
      return NextResponse.json(
        { error: 'StartStop and EndStop cannot be the same.' },
        { status: 400 }
      );
    }

    // Check if StartStopID or EndStopID is included in RouteStops
    if (uniqueStopIds.has(StartStopID)) {
      return NextResponse.json(
        { error: 'StartStop should not be included in RouteStops list.' },
        { status: 400 }
      );
    }
    if (uniqueStopIds.has(EndStopID)) {
      return NextResponse.json(
        { error: 'EndStop should not be included in RouteStops list.' },
        { status: 400 }
      );
    }

    // Step 1: Soft delete if IsDeleted is true
    if (IsDeleted === true) {
      const softDeletedRoute = await prisma.route.update({
        where: { RouteID },
        data: { IsDeleted: true },
      });

      return NextResponse.json(softDeletedRoute, { status: 200 });
    }

    // Step 2: Find the existing Route
    const existingRoute = await prisma.route.findUnique({
      where: { RouteID },
    });

    if (!existingRoute) {
      return NextResponse.json({ error: 'Route not found.' }, { status: 404 });
    }

    // Step 3: Update the Route with the new data (if provided)
    const updatedRoute = await prisma.route.update({
      where: { RouteID },
      data: {
        RouteName: RouteName ?? existingRoute.RouteName,
        StartStopID: StartStopID ?? existingRoute.StartStopID,
        EndStopID: EndStopID ?? existingRoute.EndStopID,
        IsDeleted: existingRoute.IsDeleted, // Keep current IsDeleted unless soft-deleted earlier
      },
    });

    // Step 4: Handle RouteStops if provided (delete old and add new ones)
    if (routeStopIds.length > 0) {
      await prisma.$transaction(async (prismaTx) => {
        await prismaTx.routeStop.deleteMany({
          where: { RouteID },
        });

        await Promise.all(
          rawRouteStops.map(async (routeStop: RouteStopInput) => {
            const stopIdValue =
              typeof routeStop.StopID === 'string' ? routeStop.StopID : routeStop.StopID?.StopID;

            const RouteStopID = await generateFormattedID('RTS'); // Your ID generation function

            return prismaTx.routeStop.create({
              data: {
                RouteStopID,
                RouteID,
                StopID: stopIdValue,
                StopOrder: routeStop.StopOrder,
              },
            });
          })
        );
      });
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

    console.error('Error updating route:', error);
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Extract RouteID from URL path (last segment)
    const url = new URL(req.url);
    const RouteID = url.pathname.split('/').pop();

    if (!RouteID) {
      return NextResponse.json(
        { error: 'RouteID is required in the URL path.' },
        { status: 400 }
      );
    }

    const { isDeleted } = await req.json();
    
    const updatedRoute = await prisma.route.update({
      where: { RouteID },
      data: { IsDeleted: isDeleted },
    });

    return NextResponse.json(updatedRoute, { status: 200 });
  } catch (error) {
    console.error('Error updating route:', error);
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 });
  }
}
