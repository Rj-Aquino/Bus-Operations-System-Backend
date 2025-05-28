import { fetchBuses } from '@/lib/fetchBuses';
import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const buses = await fetchBuses();

    if (!buses || buses.length === 0) {
      return NextResponse.json({ message: 'No buses found', data: [] }, { status: 204 });
    }

    return NextResponse.json({ data: buses }, { status: 200 });

  } catch (error) {
    console.error('GET_BUSES_ERROR', error);
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 });
  }
}