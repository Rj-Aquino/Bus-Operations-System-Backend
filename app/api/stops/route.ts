import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { generateFormattedID } from '../../../lib/idGenerator';

export async function GET() {
  try {
    const stops = await prisma.stop.findMany({
      where: {
        IsDeleted: false,
      },
      select: {
        StopID: true,
        StopName: true,
        latitude: true,
        longitude: true,
      },
    });

    return NextResponse.json(stops);
  } catch (error) {
    console.error('Failed to fetch stops:', error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { StopName, latitude, longitude } = body;

    // Input validation
    if (typeof StopName !== 'string' || typeof latitude !== 'string' || typeof longitude !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input. All fields must be non-empty strings.' },
        { status: 400 }
      );
    }

    // Generate unique StopID
    const StopID = await generateFormattedID('STP');

    const newStop = await prisma.stop.create({
      data: {
        StopID,
        StopName,
        latitude,
        longitude
      },
      select: {
        StopID: true,
        StopName: true,
        latitude: true,
        longitude: true,
      },
    });

    return NextResponse.json(newStop, { status: 201 });
  } catch (error) {
    console.error('Failed to create stop:', error);
    return NextResponse.json({ error: 'Failed to create stop' }, { status: 500 });
  }
}