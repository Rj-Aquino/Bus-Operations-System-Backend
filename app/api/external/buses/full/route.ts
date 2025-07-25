import { fetchNewBuses } from '@/lib/fetchExternal';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { CACHE_KEYS, getCache, setCache } from '@/lib/cache';

const BUSES_CACHE_KEY = CACHE_KEYS.BUSES_ALL ?? '';

const getHandler = async (request: NextRequest) => {
  // const { user, error, status } = await authenticateRequest(request);
  // if (error) {
  //   return NextResponse.json({ error }, { status });
  // }

  // Try cache first
 // const cached = await getCache<any[]>(BUSES_CACHE_KEY);
//  if (cached) {
 //   return NextResponse.json(
  //    {
  //      message: cached.length ? undefined : 'No buses found',
   //     data: cached,
//    },
  //    { status: 200 }
//    );
//  }

  try {
    const buses = await fetchNewBuses();

    const mappedBuses = (buses.buses ?? [])
      .filter((bus: any) => bus.status === 'ACTIVE')
      .map((bus: any) => ({
        busId: bus.bus_id,
        license_plate: bus.plate_number,
        body_number: bus.body_number,
        type: bus.bus_type?.toUpperCase() === 'AIRCONDITIONED' ? 'Aircon' : 'Non-Aircon',
        capacity: bus.seat_capacity,
        //body_builder: bus.body_builder,
        // route: bus.route, // old only, not present in new
      }));

    await setCache(BUSES_CACHE_KEY, mappedBuses);

    return NextResponse.json(
      {
        message: mappedBuses.length ? undefined : 'No buses found',
        data: mappedBuses,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_BUSES_ALL_ERROR', message);
    return NextResponse.json({ error: 'Failed to fetch buses', details: message }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));