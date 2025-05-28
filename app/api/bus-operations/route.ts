import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { BusOperationStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
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
        RegularBusAssignment: {
          select: {
            Change: true,
            TripRevenue: true,
            quotaPolicy: {
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

    return NextResponse.json(busAssignments);
  } catch (error) {
    console.error('Error fetching bus assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch bus assignments' }, { status: 500 });
  }
}
