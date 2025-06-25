//import { fetchConductors } from '@/lib/fetchExternal';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { CACHE_KEYS, getCache, setCache } from '@/lib/cache';

const CONDUCTORS_CACHE_KEY = CACHE_KEYS.CONDUCTORS_ALL ?? '';

async function fetchConductors() {
  const res = await fetch(process.env.CONDUCTOR_URL as string);
  if (!res.ok) throw new Error('Failed to fetch conductors');
  return res.json();
}

const getHandler = async (request: NextRequest) => {
  // const { user, error, status } = await authenticateRequest(request);
  // if (error) {
  //   return NextResponse.json({ error }, { status });
  // }

  // Try cache first
  const cached = await getCache<any[]>(CONDUCTORS_CACHE_KEY);
  if (cached) {
    return NextResponse.json(
      {
        message: cached.length ? undefined : 'No conductors found',
        data: cached,
      },
      { status: 200 }
    );
  }

  try {
    const employees = await fetchConductors();

    // Map to required conductor fields
    const conductors = employees.map((emp: any) => ({
      conductor_id: emp.employeeNumber,
      name: `${emp.firstName} ${emp.middleName ? emp.middleName + ' ' : ''}${emp.lastName}`,
      contactNo: emp.phone,
      address: `${emp.barangay ?? ''}${emp.zipCode ? ', ' + emp.zipCode : ''}`,
    }));

    await setCache(CONDUCTORS_CACHE_KEY, conductors);

    return NextResponse.json(
      {
        message: conductors.length ? undefined : 'No conductors found',
        data: conductors,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_CONDUCTORS_ALL_ERROR', message);
    return NextResponse.json({ error: 'Failed to fetch conductors', details: message }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));