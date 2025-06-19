import { fetchDrivers } from '@/lib/fetchExternal';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import prisma from '@/client';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

const DRIVERS_CACHE_KEY =  CACHE_KEYS.DRIVERS ?? '';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache<any[]>(DRIVERS_CACHE_KEY);
  if (cached) {
    return NextResponse.json(
      {
        message: cached.length > 0 ? 'Drivers fetched successfully' : 'No drivers found',
        data: cached,
      },
      { status: 200 }
    );
  }

  try {
    const drivers = await fetchDrivers();

    // Get all assigned (not deleted) DriverIDs from the database
    const assignedDrivers = await prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: { IsDeleted: false }
      },
      select: { DriverID: true },
    });
    const assignedDriverIDs = new Set(assignedDrivers.map(d => String(d.DriverID)));

    // Filter out assigned drivers from the external API (which uses driver_id)
    const unassignedDrivers = drivers.filter((driver: any) => !assignedDriverIDs.has(String(driver.driver_id)));

    await setCache(DRIVERS_CACHE_KEY, unassignedDrivers);

    return NextResponse.json(
      {
        message: unassignedDrivers.length > 0 ? 'Drivers fetched successfully' : 'No drivers found',
        data: unassignedDrivers,
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