import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { delCache } from '@/lib/cache';

const STOPS_CACHE_KEY = 'stops_list';

const putHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const StopID = url.pathname.split('/').pop();

    if (!StopID) {
      return NextResponse.json({ error: 'StopID is required in the URL.' }, { status: 400 });
    }

    const { StopName, latitude, longitude } = await request.json();

    const existingStop = await prisma.stop.findUnique({
      where: { StopID },
      select: { StopID: true },
    });

    if (!existingStop) {
      return NextResponse.json({ error: 'Stop not found.' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (typeof StopName === 'string') updateData.StopName = StopName;
    if (typeof latitude === 'string') updateData.latitude = latitude;
    if (typeof longitude === 'string') updateData.longitude = longitude;
    updateData.UpdatedBy = user?.employeeId || null;

    if (Object.keys(updateData).length === 1 && updateData.UpdatedBy) {
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
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
      },
    });

    await delCache(STOPS_CACHE_KEY);
    return NextResponse.json(updatedStop, { status: 200 });
  } catch (error) {
    console.error('Failed to update stop:', error);
    return NextResponse.json({ error: 'Failed to update stop' }, { status: 500 });
  }
};

const patchHandler = async (req: NextRequest) => {
  const { user, error, status } = await authenticateRequest(req);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(req.url);
    const StopID = url.pathname.split('/').pop();

    if (!StopID) {
      return NextResponse.json({ error: 'StopID is required in the URL.' }, { status: 400 });
    }

    const { IsDeleted } = await req.json();

    if (typeof IsDeleted !== 'boolean') {
      return NextResponse.json({ error: '`IsDeleted` must be a boolean.' }, { status: 400 });
    }

    const existing = await prisma.stop.findUnique({
      where: { StopID },
      select: { StopID: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Stop not found.' }, { status: 404 });
    }

    const updatedStop = await prisma.stop.update({
      where: { StopID },
      data: { IsDeleted, UpdatedBy: user?.employeeId || null },
      select: {
        StopID: true,
        StopName: true,
        latitude: true,
        longitude: true,
        IsDeleted: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
      },
    });

    await delCache(STOPS_CACHE_KEY);
    return NextResponse.json(updatedStop, { status: 200 });
  } catch (error) {
    console.error('Error in PATCH /stop:', error);
    return NextResponse.json({ error: 'Failed to update stop.' }, { status: 500 });
  }
};

export const PUT = withCors(putHandler);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));