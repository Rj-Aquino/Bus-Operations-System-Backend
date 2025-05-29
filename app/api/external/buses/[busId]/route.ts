import { fetchBusById } from '@/lib/fetchBuses';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { NextRequest, NextResponse } from 'next/server';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const busId = decodeURIComponent(parts.at(-1) || '').trim();

    if (!busId) {
      return NextResponse.json({ error: 'Missing bus ID' }, { status: 400 });
    }

    const bus = await fetchBusById(busId);

    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 });
    }

    return NextResponse.json({ data: bus }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error('GET_BUS_BY_ID_ERROR', message);

    return NextResponse.json({
      error: 'Failed to fetch bus',
      details: message,
    }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
