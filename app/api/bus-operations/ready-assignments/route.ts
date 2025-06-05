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
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            BusTrips: {
              select: {
                BusTripID: true,
                DispatchedAt: true,
                CompletedAt: true,
                Sales: true,
                ChangeFund: true,
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
        TicketBusAssignments: {
          select: {
            TicketBusAssignmentID: true,
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
    });

    return NextResponse.json(verifiedAssignments);
  } catch (error) {
    console.error('Error fetching verified assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch verified assignments' }, { status: 500 });
  }
};

export const GET = withCors(getVerifiedAssignments);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));