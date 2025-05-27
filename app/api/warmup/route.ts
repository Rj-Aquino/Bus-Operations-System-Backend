import { fetchBuses } from '@/lib/fetchBuses';
import { fetchConductors } from '@/lib/fetchConductors';
import { fetchDrivers } from '@/lib/fetchDrivers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await Promise.all([
      fetchBuses(),
      fetchConductors(),
      fetchDrivers(),
    ]);

    return NextResponse.json({ message: 'Cache warmed successfully' });
  } catch (error) {
    console.error('Warmup error:', error);
    return NextResponse.json({ error: 'Cache warmup failed' }, { status: 500 });
  }
}