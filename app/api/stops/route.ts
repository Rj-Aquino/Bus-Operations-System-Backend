import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { generateFormattedID } from '../../../lib/idGenerator';

export async function GET() {
  try {
    const stops = await prisma.stop.findMany({
      where: {
        IsDeleted: false, // Only fetch stops that are not soft-deleted
      },
      include: {
        routesAsStart: true,
        routesAsEnd: true,
        RouteStops: true,
      },
    });

    return NextResponse.json(stops);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { StopName, latitude, longitude  } = await req.json();

    // Validate input
    if (!StopName || !latitude || !longitude) {
      return NextResponse.json(
        { error: 'Invalid input. StopName and Location with latitude and longitude are required.' },
        { status: 400 }
      );
    }

    // Generate a unique StopID
    const StopID = await generateFormattedID('STP');

    // Create a new stop in the database
    const newStop = await prisma.stop.create({
      data: {
        StopID,
        StopName,
        latitude: latitude,
        longitude: longitude,
        IsDeleted: false, // Default to false when creating
      },
    });

    return NextResponse.json(newStop, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create stop' }, { status: 500 });
  }
}
