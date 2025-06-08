import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const getVerifiedAssignments = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const verifiedAssignments = await prisma.busAssignment.findMany({
      where: {
        IsDeleted: false,
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
        RegularBusAssignment: {
          isNot: null,
        },
      },
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
        Route: { // <-- Add this block
          select: {
            RouteID: true,
            RouteName: true,
          },
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
    const result = verifiedAssignments.map((assignment) => {
      if (
        assignment.RegularBusAssignment &&
        assignment.RegularBusAssignment.LatestBusTripID === null
      ) {
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
    console.error('Error fetching verified assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch verified assignments' }, { status: 500 });
  }
};

export const GET = withCors(getVerifiedAssignments);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));