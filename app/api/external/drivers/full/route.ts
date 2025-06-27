import { fetchNewDrivers } from '@/lib/fetchExternal';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

const DRIVERS_CACHE_KEY = CACHE_KEYS.DRIVERS_ALL ?? '';

const getHandler = async (request: NextRequest) => {
  // const { user, error, status } = await authenticateRequest(request);
  // if (error) {
  //   return NextResponse.json({ error }, { status });
  // }

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
     const employees = await fetchNewDrivers();

    // Map to required driver fields
    const drivers = employees.map((emp: any) => ({
      driver_id: emp.employeeNumber,
      name: `${emp.firstName} ${emp.middleName ? emp.middleName + ' ' : ''}${emp.lastName}`,
      contactNo: emp.phone,
      address: `${emp.barangay ?? ''}${emp.zipCode ? ', ' + emp.zipCode : ''}`,
    }));

    await setCache(DRIVERS_CACHE_KEY, drivers);

    return NextResponse.json(
      {
        message: drivers.length > 0 ? 'Drivers fetched successfully' : 'No drivers found',
        data: drivers,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_DRIVERS_ALL_ERROR', message);

    return NextResponse.json({ error: 'Failed to fetch drivers', details: message }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));