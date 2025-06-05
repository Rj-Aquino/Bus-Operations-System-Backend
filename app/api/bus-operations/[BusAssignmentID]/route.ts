import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';

enum BusOperationStatus {
  NotStarted = 'NotStarted',
  InOperation = 'InOperation',
  Completed = 'Completed',
  NotReady = 'NotReady',
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

const putHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

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

    // Handle BusTrips update or creation if present in body
    if (
      updatedBusAssignment.RegularBusAssignment &&
      Array.isArray(body.BusTrips)
    ) {
      for (const trip of body.BusTrips) {
        const {
          BusTripID,
          DispatchedAt,
          CompletedAt,
          Sales,
          ChangeFund,
        } = trip;

        const regularBusAssignmentID = updatedBusAssignment.RegularBusAssignment.RegularBusAssignmentID;

        if (BusTripID) {
          // Try to update existing BusTrip
          const existingBusTrip = await prisma.busTrip.findFirst({
            where: {
              BusTripID,
              RegularBusAssignmentID: regularBusAssignmentID,
            },
          });

          if (existingBusTrip) {
            await prisma.busTrip.update({
              where: { BusTripID },
              data: {
                DispatchedAt: DispatchedAt ? new Date(DispatchedAt) : null,
                CompletedAt: CompletedAt ? new Date(CompletedAt) : null,
                Sales: typeof Sales === 'number' ? Sales : null,
                ChangeFund: typeof ChangeFund === 'number' ? ChangeFund : null,
              },
            });
            continue;
          }
        }

        // If no BusTripID or not found, create a new BusTrip
        await prisma.busTrip.create({
          data: {
            BusTripID: BusTripID || await generateFormattedID('BT'),
            RegularBusAssignmentID: regularBusAssignmentID,
            DispatchedAt: DispatchedAt ? new Date(DispatchedAt) : null,
            CompletedAt: CompletedAt ? new Date(CompletedAt) : null,
            Sales: typeof Sales === 'number' ? Sales : null,
            ChangeFund: typeof ChangeFund === 'number' ? ChangeFund : null,
          },
        });
      }
    }

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
            BusTrips: { 
              select: {
                BusTripID: true,
                DispatchedAt: true,
                CompletedAt: true,
                Sales: true,
                ChangeFund: true,
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
};

export const PUT = withCors(putHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));