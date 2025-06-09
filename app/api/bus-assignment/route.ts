import { redis } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';

const ASSIGNMENTS_CACHE_KEY = 'regular_bus_assignments';
const TTL_SECONDS = 60 * 60; // 1 hour cache

const gethandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // 1. Check Redis cache
  const cached = await redis.get(ASSIGNMENTS_CACHE_KEY);
  if (cached && typeof cached === 'string') {
    try {
      return NextResponse.json(JSON.parse(cached), { status: 200 });
    } catch {
      await redis.del(ASSIGNMENTS_CACHE_KEY); // Clear bad cache
    }
  }

  // 2. Fetch from Prisma
  try {
    const assignments = await prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: {
          IsDeleted: false,
        },
      },
      select: {
        RegularBusAssignmentID: true,
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
        BusAssignment: {
          select: {
            IsDeleted: true,
            BusID: true,
            Route: {
              select: {
                RouteID: true,
                RouteName: true,
              },
            },
          },
        },
      },
    });

    // 3. Cache the result
    await redis.set(ASSIGNMENTS_CACHE_KEY, JSON.stringify(assignments), { ex: TTL_SECONDS });

    return NextResponse.json(assignments, { status: 200 });
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

    // TODO: Add validation for required fields here (BusID, RouteID, DriverID, etc.)
    // Also validate data.QuotaPolicies is an array with at least one element

    const busAssignmentID = generateFormattedID('BA');

    await prisma.$transaction(async (tx) => {
      // 1. Create BusAssignment with RegularBusAssignment (1:1 via ID)
      await tx.busAssignment.create({
        data: {
          BusAssignmentID: busAssignmentID,
          BusID: data.BusID,
          RouteID: data.RouteID,
          AssignmentDate: data.AssignmentDate ? new Date(data.AssignmentDate) : new Date(),
          RegularBusAssignment: {
            create: {
              DriverID: data.DriverID,
              ConductorID: data.ConductorID,
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
        };

        if (qp.type && qp.type.toUpperCase() === 'FIXED') {
          quotaPolicyData.Fixed = {
            create: {
              Quota: qp.value,
            },
          };
        } else if (qp.type && qp.type.toUpperCase() === 'PERCENTAGE') {
          quotaPolicyData.Percentage = {
            create: {
              Percentage: qp.value,
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
        AssignmentDate: true,
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

    await redis.del('regular_bus_assignments');
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