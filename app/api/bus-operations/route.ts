import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database

enum BusOperationStatus {
  NotStarted = 'NotStarted',
  InOperation = 'InOperation',
  Completed = 'Completed',
}

type BusAssignmentWhereInput = {
  IsDeleted?: boolean;
  Status?: BusOperationStatus;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const whereClause: BusAssignmentWhereInput = { IsDeleted: false };

    if (status !== null) {
      if (
        status === BusOperationStatus.NotStarted ||
        status === BusOperationStatus.InOperation ||
        status === BusOperationStatus.Completed
      ) {
        whereClause.Status = status;
      } else {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
    }

    const busAssignments = await prisma.busAssignment.findMany({
      where: whereClause,
      include: {
        RegularBusAssignment: true,
        TicketBusAssignments: {
          include: {
            TicketType: true,
          },
        },
      },
    });

    return NextResponse.json(busAssignments);
  } catch (error) {
    console.error('Failed to fetch bus assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch bus assignments' }, { status: 500 });
  }
}
