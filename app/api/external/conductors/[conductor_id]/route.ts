import { fetchConductorById } from '@/lib/fetchConductors';
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
    const conductorId = decodeURIComponent(url.pathname.split('/').at(-1) || '').trim();

    if (!conductorId) {
      return NextResponse.json({ error: 'Missing conductor ID' }, { status: 400 });
    }

    const conductor = await fetchConductorById(conductorId);

    if (!conductor) {
      return NextResponse.json({ error: 'Conductor not found' }, { status: 404 });
    }

    return NextResponse.json({ data: conductor }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_CONDUCTOR_BY_ID_ERROR', message);

    return NextResponse.json({
      error: 'Failed to fetch conductor',
      details: message,
    }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
