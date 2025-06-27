import { fetchNewConductors } from '@/lib/fetchExternal';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';
import prisma from '@/client';

const CONDUCTORS_CACHE_KEY = CACHE_KEYS.CONDUCTORS ?? '';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  // if (error) {
  //   return NextResponse.json({ error }, { status });
  // }

  // Try cache first
  // const cached = await getCache<any[]>(CONDUCTORS_CACHE_KEY);
  // if (cached) {
    // return NextResponse.json(
   // {
   //   message: cached.length ? undefined : 'No conductors found',
       // data: cached,
    //  },
   //   { status: 200 }
  //  );
//  }

  try {
    const employees = await fetchNewConductors();

    // Map to required conductor fields
    const conductors = employees.map((emp: any) => ({
      conductor_id: emp.employeeNumber,
      name: `${emp.firstName} ${emp.middleName ? emp.middleName + ' ' : ''}${emp.lastName}`,
      contactNo: emp.phone,
      address: `${emp.barangay ?? ''}${emp.zipCode ? ', ' + emp.zipCode : ''}`,
    }));

    // Get all assigned (not deleted) ConductorIDs from the database
    const assignedConductors = await prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: { IsDeleted: false }
      },
      select: { ConductorID: true },
    });
    const assignedConductorIDs = new Set(assignedConductors.map(c => String(c.ConductorID)));

    // Filter out assigned conductors
    const unassignedConductors = conductors.filter((conductor: any) => !assignedConductorIDs.has(String(conductor.conductor_id)));

    await setCache(CONDUCTORS_CACHE_KEY, unassignedConductors);

    return NextResponse.json(
      {
        message: unassignedConductors.length ? undefined : 'No conductors found',
        data: unassignedConductors,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET_CONDUCTORS_ERROR', message);
    return NextResponse.json({ error: 'Failed to fetch conductors', details: message }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));