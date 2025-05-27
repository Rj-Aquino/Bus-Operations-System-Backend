import { fetchBuses } from '@/lib/fetchBuses';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const buses = await fetchBuses();
    return NextResponse.json({ data: buses });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 });
  }
}
