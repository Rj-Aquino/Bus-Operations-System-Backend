import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS} from '@/lib/cache';

const ROUTES_CACHE_KEY_FULL = CACHE_KEYS.ROUTES_FULL ?? '';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache<any[]>(ROUTES_CACHE_KEY_FULL);
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
    const routes = await prisma.route.findMany({
      where: {
        IsDeleted: false,
      },
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        RouteID: true,
        RouteName: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
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
                StopID: true,
                StopName: true,
              },
            },
          },
        },
      },
    });

    // Apply UpdatedAt/UpdatedBy logic before caching and returning
    const processed = routes.map(item => {
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });

    await setCache(ROUTES_CACHE_KEY_FULL, processed);
    return NextResponse.json(processed);
  } catch (error) {
    console.error('Failed to fetch full route details:', error);
    return NextResponse.json({ error: 'Failed to fetch full route details' }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));