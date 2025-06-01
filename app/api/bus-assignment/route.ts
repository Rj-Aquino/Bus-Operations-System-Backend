import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { createQuotaPolicy } from '@/lib/quotaPolicy';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const gethandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

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
        Change: true,
        TripRevenue: true,
        quota_Policy: {
          select: {
            QuotaPolicyID: true,
            Fixed: { select: { Quota: true } },
            Percentage: { select: { Percentage: true } },
          },
        },
        BusAssignment: {
          select: {
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

    return NextResponse.json(assignments, { status: 200 });
  } catch (error) {
    console.error('REGULAR_ASSIGNMENTS_ERROR', error);
    return NextResponse.json({ error: 'Failed to fetch assignments asdasdasd' }, { status: 500 });
  }
};

const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const data = await request.json();

    // ...validation code...

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create BusAssignment and RegularBusAssignment
      const busAssignmentID = await generateFormattedID('BA');
      const busAssignment = await tx.busAssignment.create({
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
        select: {
          BusAssignmentID: true,
          AssignmentDate: true,
          RegularBusAssignment: {
            select: {
              RegularBusAssignmentID: true,
              DriverID: true,
              ConductorID: true,
              Change: true,
              TripRevenue: true,
            },
          },
        },
      });

      const regularBusAssignmentID = busAssignment.RegularBusAssignment?.RegularBusAssignmentID;
      if (!regularBusAssignmentID) {
        throw new Error('Failed to create RegularBusAssignment');
      }

      // 2. Create Quota_Policy
      await tx.quota_Policy.create({
        data: {
          QuotaPolicyID: await generateFormattedID('QP'),
          RegularBusAssignmentID: regularBusAssignmentID,
          ...(data.QuotaPolicy[0].type.toUpperCase() === 'FIXED'
            ? {
                Fixed: {
                  create: {
                    FQuotaPolicyID: await generateFormattedID('QP'),
                    Quota: data.QuotaPolicy[0].value,
                  },
                },
              }
            : {
                Percentage: {
                  create: {
                    PQuotaPolicyID: await generateFormattedID('QP'),
                    Percentage: data.QuotaPolicy[0].value,
                  },
                },
              }),
        },
      });

      // 3. Fetch the full assignment with quota policy for response
      return tx.busAssignment.findUnique({
        where: { BusAssignmentID: busAssignmentID },
        select: {
          BusAssignmentID: true,
          AssignmentDate: true,
          RegularBusAssignment: {
            select: {
              DriverID: true,
              ConductorID: true,
              Change: true,
              TripRevenue: true,
              quota_Policy: {
                select: {
                  QuotaPolicyID: true,
                  Fixed: { select: { Quota: true } },
                  Percentage: { select: { Percentage: true } },
                },
              },
            },
          },
        },
      });
    });

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