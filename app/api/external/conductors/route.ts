import { fetchConductors } from '@/lib/fetchConductors';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const conductors = await fetchConductors();

    return NextResponse.json(
      {
        message: conductors.length ? undefined : 'No conductors found',
        data: conductors,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_CONDUCTORS_ERROR', message);
    return NextResponse.json({ error: 'Failed to fetch conductors', details: message }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
