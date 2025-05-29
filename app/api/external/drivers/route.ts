import { fetchDrivers } from '@/lib/fetchDrivers';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const drivers = await fetchDrivers();

    return NextResponse.json(
      {
        message: drivers.length > 0 ? 'Drivers fetched successfully' : 'No drivers found',
        data: drivers,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_DRIVERS_ERROR', message);

    return NextResponse.json({ error: 'Failed to fetch drivers', details: message }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
