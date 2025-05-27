import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';

export async function PUT(request: Request) {
  try {
    // Extract StopID from URL path (last segment)
    const url = new URL(request.url);
    const StopID = url.pathname.split('/').pop();

    if (!StopID) {
      return NextResponse.json({ error: 'StopID is required in the URL' }, { status: 400 });
    }

    const data = await request.json();
    const { StopName, latitude, longitude, IsDeleted } = data;

    const existingStop = await prisma.stop.findUnique({
      where: { StopID },
    });

    if (!existingStop) {
      return NextResponse.json({ error: 'Stop not found.' }, { status: 404 });
    }

    if (IsDeleted === true) {
      const softDeletedStop = await prisma.stop.update({
        where: { StopID },
        data: { IsDeleted: true },
      });
      return NextResponse.json(softDeletedStop, { status: 200 });
    }

    const updatedStop = await prisma.stop.update({
      where: { StopID },
      data: {
        StopName,
        latitude,
        longitude,
        IsDeleted: false,
      },
    });

    return NextResponse.json(updatedStop, { status: 200 });
  } catch (error) {
    console.error('Error updating stop:', error);
    return NextResponse.json({ error: 'Failed to update stop' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const StopID = url.pathname.split('/').pop();

    if (!StopID) {
      return NextResponse.json(
        { error: 'StopID is required' },
        { status: 400 }
      );
    }

    const { isDeleted } = await req.json();

    if (typeof isDeleted !== 'boolean') {
      return NextResponse.json(
        { error: 'isDeleted must be a boolean' },
        { status: 400 }
      );
    }

    const updatedStop = await prisma.stop.update({
      where: { StopID },
      data: { IsDeleted: isDeleted },
    });

    return NextResponse.json(updatedStop, { status: 200 });
  } catch (error) {
    console.error('Error updating stop:', error);
    return NextResponse.json(
      { error: 'Failed to update stop' },
      { status: 500 }
    );
  }
}
