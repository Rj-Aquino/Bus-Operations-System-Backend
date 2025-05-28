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
      'Air', 'Gas', 'Engine', 'TireCondition',
      'Self_Driver', 'Self_Conductor',
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

    // Update RegularBusAssignment
    const regularUpdateFields: RegularBusAssignmentUpdateData = {};
    if ('Change' in body) regularUpdateFields.Change = Number(body.Change);
    if ('TripRevenue' in body) regularUpdateFields.TripRevenue = Number(body.TripRevenue);

    if (updatedBusAssignment.RegularBusAssignment) {
      if (Object.keys(regularUpdateFields).length > 0) {
        await prisma.regularBusAssignment.update({
          where: {
            RegularBusAssignmentID: updatedBusAssignment.RegularBusAssignment.RegularBusAssignmentID,
          },
          data: regularUpdateFields,
        });
      }
    } else if (Object.keys(regularUpdateFields).length > 0) {
      return NextResponse.json({
        error: 'No RegularBusAssignment related to this BusAssignment to update Change or TripRevenue',
      }, { status: 400 });
    }

    // Update TicketBusAssignments scoped by BusAssignmentID and TicketTypeID
    if (Array.isArray(body.TicketBusAssignments)) {
      for (const ticket of body.TicketBusAssignments) {
        const { TicketTypeID, StartingIDNumber, EndingIDNumber } = ticket;

        if (
          !TicketTypeID ||
          typeof StartingIDNumber !== 'number' ||
          typeof EndingIDNumber !== 'number' ||
          StartingIDNumber < 0 ||
          EndingIDNumber < StartingIDNumber
        ) {
          return NextResponse.json({
            error: 'Valid TicketTypeID, StartingIDNumber and EndingIDNumber are required',
          }, { status: 400 });
        }

        const existing = await prisma.ticketBusAssignment.findFirst({
          where: {
            BusAssignmentID,
            TicketTypeID,
          },
        });

        if (!existing) {
          return NextResponse.json({
            error: `No TicketBusAssignment found for TicketTypeID: ${TicketTypeID} under this BusAssignment`,
          }, { status: 404 });
        }

        await prisma.ticketBusAssignment.updateMany({
          where: {
            BusAssignmentID,
            TicketTypeID,
          },
          data: {
            StartingIDNumber,
            EndingIDNumber,
          },
        });
      }
    }

    // Return updated full record
    const updatedFullRecord = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
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
                Fixed: { select: { Quota: true } },
                Percentage: { select: { Percentage: true } },
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
              select: { Value: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedFullRecord, { status: 200 });

  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}
