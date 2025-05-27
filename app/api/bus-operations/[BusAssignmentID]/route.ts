import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';

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
  const url = new URL(request.url);
  const BusAssignmentID = url.pathname.split('/').pop();

  if (!BusAssignmentID) {
    return NextResponse.json({ error: 'BusAssignmentID is required in URL' }, { status: 400 });
  }

  try {
    const body = await request.json();

    if (body.Status && !Object.values(BusOperationStatus).includes(body.Status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // Prepare BusAssignment fields
    const busAssignmentFields: BusAssignmentUpdateData = {};
    const booleanFields: (keyof BusAssignmentUpdateData)[] = [
      'Battery', 'Lights', 'Oil', 'Water', 'Break',
      'Air', 'Gas', 'Engine', 'TireCondition', 'Self_Driver', 'Self_Conductor',
    ];

    if (body.Status) busAssignmentFields.Status = body.Status;

    for (const field of booleanFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        busAssignmentFields[field] = body[field];
      }
    }

    const updatedBusAssignment = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: busAssignmentFields,
      include: { RegularBusAssignment: true },
    });

    // Prepare RegularBusAssignment fields
    const regularFields: (keyof RegularBusAssignmentUpdateData)[] = ['Change', 'TripRevenue'];
    const regularBusAssignmentFields: RegularBusAssignmentUpdateData = {};

    for (const field of regularFields) {
      if (field in body) {
        regularBusAssignmentFields[field] = Number(body[field]);
      }
    }

    if (updatedBusAssignment.RegularBusAssignment) {
      if (Object.keys(regularBusAssignmentFields).length > 0) {
        await prisma.regularBusAssignment.update({
          where: {
            RegularBusAssignmentID: updatedBusAssignment.RegularBusAssignment.RegularBusAssignmentID,
          },
          data: regularBusAssignmentFields,
        });
      }
    } else if (Object.keys(regularBusAssignmentFields).length > 0) {
      return NextResponse.json({
        error: 'No RegularBusAssignment related to this BusAssignment to update Change or TripRevenue',
      }, { status: 400 });
    }

    // Update TicketBusAssignments
    if (Array.isArray(body.TicketBusAssignments)) {
      for (const ticket of body.TicketBusAssignments) {
        const { TicketTypeID, Quantity } = ticket;

        if (!TicketTypeID || typeof Quantity !== 'number' || Quantity <= 0) {
          return NextResponse.json({ error: 'TicketTypeID and positive Quantity are required' }, { status: 400 });
        }

        const existingTicket = await prisma.ticketBusAssignment.findFirst({
          where: { BusAssignmentID, TicketTypeID },
        });

        if (!existingTicket) {
          return NextResponse.json({
            error: `No TicketBusAssignment found for TicketTypeID: ${TicketTypeID}`,
          }, { status: 404 });
        }

        await prisma.ticketBusAssignment.updateMany({
          where: { BusAssignmentID, TicketTypeID },
          data: {
            StartingIDNumber: existingTicket.StartingIDNumber,
            EndingIDNumber: existingTicket.StartingIDNumber + Quantity - 1,
          },
        });
      }
    }

    return NextResponse.json({ message: 'Update successful' });

  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}
