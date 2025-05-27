import { fetchBuses } from '@/lib/fetchBuses';
import { fetchConductors } from '@/lib/fetchConductors';
import { fetchDrivers } from '@/lib/fetchDrivers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [buses, conductors, drivers] = await Promise.allSettled([
      fetchBuses(),
      fetchConductors(),
      fetchDrivers(),
    ]);

    const failed = [buses, conductors, drivers]
      .map((result, index) => ({ index, status: result.status, reason: (result as any).reason }))
      .filter(res => res.status === 'rejected');

    if (failed.length > 0) {
      console.error('Warmup failed on:', failed);
      return NextResponse.json(
        { error: 'Cache warmup failed', details: failed.map(f => `fetch ${['buses', 'conductors', 'drivers'][f.index]}`) },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Cache warmed successfully' });

  } catch (error) {
    console.error('Unexpected warmup error:', error);
    return NextResponse.json({ error: 'Unexpected cache warmup failure' }, { status: 500 });
  }
}
