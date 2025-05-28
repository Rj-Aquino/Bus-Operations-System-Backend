import { fetchConductors } from '@/lib/fetchConductors';
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
    const conductors = await fetchConductors();

    if (!conductors || conductors.length === 0) {
      return NextResponse.json({ message: 'No conductors found', data: [] }, { status: 204 });
    }

    return NextResponse.json({ data: conductors }, { status: 200 });

  } catch (error) {
    console.error('GET_CONDUCTORS_ERROR', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch conductors' }, { status: 500 });
  }
}
