import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';
import { getCache, setCache, delCache } from '@/lib/cache';

const ASSIGNMENTS_CACHE_KEY = 'regular_bus_assignments';
const TTL_SECONDS = 60 * 60; // 1 hour cache

const gethandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // 1. Check cache
  const cached = await getCache<any[]>(ASSIGNMENTS_CACHE_KEY);
  if (cached) {
    // Apply UpdatedAt/UpdatedBy logic to cached data
    const processed = cached.map(item => {
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });
    return NextResponse.json(processed, { status: 200 });
  }

  // 2. Fetch from Prisma
  try {
    const assignments = await prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: {
          IsDeleted: false,
        },
      },
      orderBy: [
        { UpdatedAt: 'desc' },
        { CreatedAt: 'desc' },
      ],
      select: {
        RegularBusAssignmentID: true,
        DriverID: true,
        ConductorID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        QuotaPolicies: {
          select: {
            QuotaPolicyID: true,
            StartDate: true,
            EndDate: true,
            Fixed: { select: { Quota: true } },
            Percentage: { select: { Percentage: true } },
          },
        },
        BusAssignment: {
          select: {
            IsDeleted: true,
            BusID: true,
            Route: {
              select: {
                RouteID: true,
                RouteName: true,
                CreatedAt: true,
                UpdatedAt: true,
                CreatedBy: true,
                UpdatedBy: true,
              },
            },
          },
        },
      },
    });

    // Apply UpdatedAt/UpdatedBy logic before caching and returning
    const processed = assignments.map(item => {
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });

    // 3. Cache the result
    await setCache(ASSIGNMENTS_CACHE_KEY, processed, TTL_SECONDS);

    return NextResponse.json(processed, { status: 200 });
  } catch (error) {
    console.error('REGULAR_ASSIGNMENTS_ERROR', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
};

const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const data = await request.json();
    console.log('Received data (POST /bus-assignment):', data);

    // 1. BusID must not already be assigned (not deleted)
    const existingBus = await prisma.busAssignment.findFirst({
      where: { BusID: data.BusID, IsDeleted: false }
    });
    if (existingBus) {
      return NextResponse.json({ error: 'Bus is already assigned.' }, { status: 400 });
    }

    // 2. DriverID must not already be assigned (not deleted)
    const existingDriver = await prisma.regularBusAssignment.findFirst({
      where: {
        DriverID: data.DriverID,
        BusAssignment: { IsDeleted: false }
      }
    });
    if (existingDriver) {
      return NextResponse.json({ error: 'Driver is already assigned.' }, { status: 400 });
    }

    // 3. ConductorID must not already be assigned (not deleted)
    const existingConductor = await prisma.regularBusAssignment.findFirst({
      where: {
        ConductorID: data.ConductorID,
        BusAssignment: { IsDeleted: false }
      }
    });
    if (existingConductor) {
      return NextResponse.json({ error: 'Conductor is already assigned.' }, { status: 400 });
    }

    const busAssignmentID = generateFormattedID('BA');

    await prisma.$transaction(async (tx) => {
      // 1. Create BusAssignment with RegularBusAssignment (1:1 via ID)
      await tx.busAssignment.create({
        data: {
          BusAssignmentID: busAssignmentID,
          BusID: data.BusID,
          RouteID: data.RouteID,
          Status: "NotReady",
          CreatedBy: user?.employeeId || null,
          RegularBusAssignment: {
            create: {
              DriverID: data.DriverID,
              ConductorID: data.ConductorID,
              CreatedBy: user?.employeeId || null,
            },
          },
        },
      });

      // 2. Create all QuotaPolicies for this RegularBusAssignment
      for (const qp of data.QuotaPolicy) {
        const quotaPolicyID = generateFormattedID('QP');
        const quotaPolicyData: any = {
          QuotaPolicyID: quotaPolicyID,
          RegularBusAssignmentID: busAssignmentID,
          ...(qp.startDate && { StartDate: new Date(qp.startDate) }),
          ...(qp.endDate && { EndDate: new Date(qp.endDate) }),
          CreatedBy: user?.employeeId || null,
        };

        if (qp.type && qp.type.toUpperCase() === 'FIXED') {
          quotaPolicyData.Fixed = {
            create: {
              Quota: qp.value,
              CreatedBy: user?.employeeId || null,
            },
          };
        } else if (qp.type && qp.type.toUpperCase() === 'PERCENTAGE') {
          quotaPolicyData.Percentage = {
            create: {
              Percentage: qp.value,
              CreatedBy: user?.employeeId || null,
            },
          };
        }

        await tx.quota_Policy.create({
          data: quotaPolicyData,
        });
      }
    }, { timeout: 10_000 });

    // 3. Fetch result after transaction
    const result = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID: busAssignmentID },
      select: {
        BusAssignmentID: true,
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
                StartDate: true,
                EndDate: true,
                Fixed: { select: { Quota: true } },
                Percentage: { select: { Percentage: true } },
              },
            },
          },
        },
      },
    });

    await delCache(ASSIGNMENTS_CACHE_KEY);
    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('CREATE_ASSIGNMENT_ERROR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create BusAssignment' },
      { status: 500 }
    );
  }
};

export const GET = withCors(gethandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));