import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const StopID = url.pathname.split('/').pop();

    if (!StopID) {
      return NextResponse.json({ error: 'StopID is required in the URL.' }, { status: 400 });
    }

    const { StopName, latitude, longitude, IsDeleted } = await request.json();

    // Check if stop exists
    const existingStop = await prisma.stop.findUnique({
      where: { StopID },
      select: { StopID: true },
    });

    if (!existingStop) {
      return NextResponse.json({ error: 'Stop not found.' }, { status: 404 });
    }

    // Prepare update data dynamically
    const updateData: Record<string, any> = {};
    if (typeof StopName === 'string') updateData.StopName = StopName;
    if (typeof latitude === 'string') updateData.latitude = latitude;
    if (typeof longitude === 'string') updateData.longitude = longitude;
    if (typeof IsDeleted === 'boolean') updateData.IsDeleted = IsDeleted;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update.' }, { status: 400 });
    }

    const updatedStop = await prisma.stop.update({
      where: { StopID },
      data: updateData,
      select: {
        StopID: true,
        StopName: true,
        latitude: true,
        longitude: true,
        IsDeleted: true,
      },
    });

    return NextResponse.json(updatedStop, { status: 200 });
  } catch (error) {
    console.error('Failed to update stop:', error);
    return NextResponse.json({ error: 'Failed to update stop' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const StopID = url.pathname.split('/').pop();

    if (!StopID) {
      return NextResponse.json({ error: 'StopID is required in the URL.' }, { status: 400 });
    }

    const { isDeleted } = await req.json();

    if (typeof isDeleted !== 'boolean') {
      return NextResponse.json({ error: '`isDeleted` must be a boolean.' }, { status: 400 });
    }

    // Confirm the stop exists first (optional but better UX)
    const existing = await prisma.stop.findUnique({
      where: { StopID },
      select: { StopID: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Stop not found.' }, { status: 404 });
    }

    const updatedStop = await prisma.stop.update({
      where: { StopID },
      data: { IsDeleted: isDeleted },
      select: {
        StopID: true,
        StopName: true,
        IsDeleted: true,
      },
    });

    return NextResponse.json(updatedStop, { status: 200 });
  } catch (error) {
    console.error('Error in PATCH /stop:', error);
    return NextResponse.json({ error: 'Failed to update stop.' }, { status: 500 });
  }
}