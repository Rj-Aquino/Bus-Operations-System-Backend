import { fetchDrivers } from '@/lib/fetchDrivers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const drivers = await fetchDrivers();

    if (!drivers || drivers.length === 0) {
      return NextResponse.json({ message: 'No drivers found', data: [] }, { status: 204 });
    }

    return NextResponse.json({ data: drivers }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_DRIVERS_ERROR', message);

    return NextResponse.json({ error: 'Failed to fetch drivers', details: message }, { status: 500 });
  }
}
