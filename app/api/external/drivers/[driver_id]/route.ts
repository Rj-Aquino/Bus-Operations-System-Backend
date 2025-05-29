import { fetchDriverById } from '@/lib/fetchDrivers';
import { authenticateRequest } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const driverId = decodeURIComponent(url.pathname.split('/').at(-1) || '').trim();

    if (!driverId) {
      return NextResponse.json({ error: 'Missing driver ID' }, { status: 400 });
    }

    const driver = await fetchDriverById(driverId);

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    return NextResponse.json({ data: driver }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_DRIVER_BY_ID_ERROR', message);

    return NextResponse.json({
      error: 'Failed to fetch driver',
      details: message,
    }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
