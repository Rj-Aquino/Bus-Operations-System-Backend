import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { BusOperationStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const whereClause: {
      IsDeleted: boolean;
      Status?: BusOperationStatus;
    } = { IsDeleted: false };

    if (status !== null) {
      const validStatuses = Object.values(BusOperationStatus);
      if (!validStatuses.includes(status as BusOperationStatus)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      whereClause.Status = status as BusOperationStatus;
    }

    // Fetch all bus assignments with their RegularBusAssignment and only the LatestBusTrip
    const busAssignments = await prisma.busAssignment.findMany({
      where: whereClause,
      select: {
        BusAssignmentID: true,
        BusID: true,
        Battery: true,
        Lights: true,
        Oil: true,
        Water: true,
        Break: true,
        Air: true,
        Gas: true,
        Engine: true,
        TireCondition: true,
        Self_Driver: true,
        Self_Conductor: true,
        IsDeleted: true,
        Status: true,
        Route: {
          select: {
            RouteID: true,
            RouteName: true,
          }
        },
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            LatestBusTripID: true,
            LatestBusTrip: {
              select: {
                BusTripID: true,
                DispatchedAt: true,
                CompletedAt: true,
                Sales: true,
                ChangeFund: true,
                TicketBusTrips: {
                  select: {
                    TicketBusTripID: true,
                    StartingIDNumber: true,
                    EndingIDNumber: true,
                    TicketType: {
                      select: {
                        TicketTypeID: true,
                        Value: true,
                      },
                    },
                  },
                },
              },
            },
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
                Fixed: {
                  select: {
                    Quota: true,
                  },
                },
                Percentage: {
                  select: {
                    Percentage: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Remove LatestBusTrip if LatestBusTripID is null
    const result = busAssignments.map((assignment) => {
      if (
        assignment.RegularBusAssignment &&
        assignment.RegularBusAssignment.LatestBusTripID === null
      ) {
        // Remove LatestBusTrip from the response
        const { LatestBusTrip, ...rest } = assignment.RegularBusAssignment;
        return {
          ...assignment,
          RegularBusAssignment: {
            ...rest,
            LatestBusTrip: undefined,
          },
        };
      }
      return assignment;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching bus assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch bus assignments' }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));