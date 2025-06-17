import { fetchBuses } from '@/lib/fetchExternal';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache } from '@/lib/cache';

const BUSES_CACHE_KEY = 'external_buses_all';
const TTL_SECONDS = 60 * 60; // 1 hour

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache<any[]>(BUSES_CACHE_KEY);
  if (cached) {
    return NextResponse.json(
      {
        message: cached.length ? undefined : 'No buses found',
        data: cached,
      },
      { status: 200 }
    );
  }

  try {
    const buses = await fetchBuses();

    await setCache(BUSES_CACHE_KEY, buses, TTL_SECONDS);

    return NextResponse.json(
      {
        message: buses.length ? undefined : 'No buses found',
        data: buses,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_BUSES_ALL_ERROR', message);
    return NextResponse.json({ error: 'Failed to fetch buses', details: message }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));