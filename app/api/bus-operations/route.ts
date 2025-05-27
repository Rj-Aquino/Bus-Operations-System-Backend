import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { BusOperationStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    // Build where clause with strict typing
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
      include: {
        RegularBusAssignment: {
          include: {
            quotaPolicy: {
              select: {
                QuotaPolicyID: true,
                StartDate: true,
                EndDate: true,
              },
            },
          },
        },
        TicketBusAssignments: {
          include: {
            TicketType: true,
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
