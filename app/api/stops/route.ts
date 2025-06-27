import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, delCache, CACHE_KEYS} from '@/lib/cache';

const STOPS_CACHE_KEY = CACHE_KEYS.STOPS_LIST ?? ' ';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache<any[]>(STOPS_CACHE_KEY);
  if (cached) {
    // Apply UpdatedAt/UpdatedBy logic to cached data
    const processed = cached.map(item => {
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });
    return NextResponse.json(processed);
  }

  try {
    const stops = await prisma.stop.findMany({
      where: { IsDeleted: false },
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
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

    // Apply UpdatedAt/UpdatedBy logic before caching and returning
    const processed = stops.map(item => {
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });

    await setCache(STOPS_CACHE_KEY, processed);
    return NextResponse.json(processed);
  } catch (error) {
    console.error('Failed to fetch stops:', error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
};

const postHandler = async (req: NextRequest) => {
  const { user, error, status } = await authenticateRequest(req);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await req.json();
    const { StopName, latitude, longitude } = body;

    if (
      typeof StopName !== 'string' ||
      typeof latitude !== 'string' ||
      typeof longitude !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid input. All fields must be non-empty strings.' },
        { status: 400 }
      );
    }

    const StopID = await generateFormattedID('STP');

    const newStop = await prisma.stop.create({
      data: {
        StopID,
        StopName,
        latitude,
        longitude,
        CreatedBy: user?.employeeId || null,
        UpdatedBy: null, // Only set CreatedBy on creation
      },
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


    // Apply UpdatedAt/UpdatedBy logic for immediate response
    const processed =
      newStop.CreatedAt &&
      newStop.UpdatedAt &&
      new Date(newStop.CreatedAt).getTime() === new Date(newStop.UpdatedAt).getTime()
        ? { ...newStop, UpdatedAt: null, UpdatedBy: null }
        : newStop;

    return NextResponse.json(processed, { status: 201 });
  } catch (error) {
    console.error('Failed to create stop:', error);
    return NextResponse.json({ error: 'Failed to create stop' }, { status: 500 });
  }
}

export const GET = withCors(getHandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));