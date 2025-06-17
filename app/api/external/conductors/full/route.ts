import { fetchConductors } from '@/lib/fetchExternal';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache } from '@/lib/cache';

const CONDUCTORS_CACHE_KEY = 'external_conductors_all';
const TTL_SECONDS = 60 * 60; // 1 hour

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache<any[]>(CONDUCTORS_CACHE_KEY);
  if (cached) {
    return NextResponse.json(
      {
        message: cached.length ? undefined : 'No conductors found',
        data: cached,
      },
      { status: 200 }
    );
  }

  try {
    const conductors = await fetchConductors();

    await setCache(CONDUCTORS_CACHE_KEY, conductors, TTL_SECONDS);

    return NextResponse.json(
      {
        message: conductors.length ? undefined : 'No conductors found',
        data: conductors,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_CONDUCTORS_ALL_ERROR', message);
    return NextResponse.json({ error: 'Failed to fetch conductors', details: message }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));