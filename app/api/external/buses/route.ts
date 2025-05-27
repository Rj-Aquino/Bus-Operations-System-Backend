import { fetchBuses } from '@/lib/fetchBuses';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const buses = await fetchBuses();

    // Return early if no data or an empty array (optional, for stricter control)
    if (!buses || buses.length === 0) {
      return NextResponse.json({ message: 'No buses found', data: [] }, { status: 204 });
    }

    return NextResponse.json({ data: buses }, { status: 200 });

  } catch (error) {
    console.error('[GET_BUSES_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 });
  }
}