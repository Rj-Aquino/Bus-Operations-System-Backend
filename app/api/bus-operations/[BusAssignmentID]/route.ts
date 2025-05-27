import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database

enum BusOperationStatus {
  NotStarted = 'NotStarted',
  InOperation = 'InOperation',
  Completed = 'Completed',
}

type BusAssignmentUpdateData = Partial<{
  Status: BusOperationStatus;
  Battery: boolean;
  Lights: boolean;
  Oil: boolean;
  Water: boolean;
  Break: boolean;
  Air: boolean;
  Gas: boolean;
  Engine: boolean;
  TireCondition: boolean;
  Self_Driver: boolean;
  Self_Conductor: boolean;
}>;

type RegularBusAssignmentUpdateData = Partial<{
  Change: number;
  TripRevenue: number;
}>;

export async function PUT(request: Request) {
  // Extract BusAssignmentID from URL
  const url = new URL(request.url);
  const BusAssignmentID = url.pathname.split('/').pop();

  if (!BusAssignmentID) {
    return NextResponse.json({ error: 'BusAssignmentID is required in URL' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Validate BusOperationStatus if present
    if (body.Status && !Object.values(BusOperationStatus).includes(body.Status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // Prepare BusAssignment update fields
    const busAssignmentFields: BusAssignmentUpdateData = {};
    const booleanFields: (keyof BusAssignmentUpdateData)[] = [
      'Battery', 'Lights', 'Oil', 'Water', 'Break',
      'Air', 'Gas', 'Engine', 'TireCondition', 'Self_Driver', 'Self_Conductor',
    ];

    if (body.Status) busAssignmentFields.Status = body.Status;

    for (const field of booleanFields) {
      if (field in body) {
        busAssignmentFields[field] = body[field];
      }
    }

    // Update BusAssignment
    const updatedBusAssignment = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: busAssignmentFields,
      include: { RegularBusAssignment: true },
    });

    // Prepare RegularBusAssignment update fields
    const regularFields: (keyof RegularBusAssignmentUpdateData)[] = ['Change', 'TripRevenue'];
    const regularBusAssignmentFields: RegularBusAssignmentUpdateData = {};

    for (const field of regularFields) {
      if (field in body) {
        regularBusAssignmentFields[field] = body[field];
      }
    }

    // Update RegularBusAssignment if related
    if (updatedBusAssignment.RegularBusAssignment) {
      if (Object.keys(regularBusAssignmentFields).length > 0) {
        await prisma.regularBusAssignment.update({
          where: { RegularBusAssignmentID: updatedBusAssignment.RegularBusAssignment.RegularBusAssignmentID },
          data: regularBusAssignmentFields,
        });
      }
    } else if (Object.keys(regularBusAssignmentFields).length > 0) {
      return NextResponse.json(
        { error: 'No RegularBusAssignment related to this BusAssignment to update Change or TripRevenue' },
        { status: 400 }
      );
    }

    // Update TicketBusAssignments quantities if provided
    if (Array.isArray(body.TicketBusAssignments)) {
      for (const ticket of body.TicketBusAssignments) {
        if (!ticket.TicketTypeID || typeof ticket.Quantity !== 'number') {
          return NextResponse.json({ error: 'TicketTypeID and Quantity are required to update tickets' }, { status: 400 });
        }

        // Fetch existing TicketBusAssignment to get StartingIDNumber
        const existingTicket = await prisma.ticketBusAssignment.findFirst({
          where: {
            BusAssignmentID,
            TicketTypeID: ticket.TicketTypeID,
          }
        });

        if (!existingTicket) {
          return NextResponse.json({ error: `No TicketBusAssignment found for TicketTypeID: ${ticket.TicketTypeID}` }, { status: 404 });
        }

        const newStart = existingTicket.StartingIDNumber; // Keep the current start
        const newEnd = newStart + ticket.Quantity - 1;

        await prisma.ticketBusAssignment.updateMany({
          where: {
            BusAssignmentID,
            TicketTypeID: ticket.TicketTypeID,
          },
          data: {
            StartingIDNumber: newStart,
            EndingIDNumber: newEnd,
          },
        });
      }
    }

    return NextResponse.json({ message: 'Update successful' });
  } catch (error) {
    console.error('Failed to update bus assignment:', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}