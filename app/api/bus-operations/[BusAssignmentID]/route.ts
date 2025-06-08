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

    // Fetch current assignment for logic
    const currentAssignment = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      include: { RegularBusAssignment: true },
    });

    if (!currentAssignment) {
      return NextResponse.json({ error: 'BusAssignment not found' }, { status: 404 });
    }

    // Determine the new booleans (from body or current)
    const newBooleans = booleanFields.map(field =>
      Object.prototype.hasOwnProperty.call(busAssignmentFields, field)
        ? !!busAssignmentFields[field]
        : !!currentAssignment[field]
    );

    // --- REVISED LOGIC ---
    // If all booleans are true and status is NotStarted, InOperation, or Completed, do nothing (allow status)
    // If any boolean is false and status is NotStarted, InOperation, or Completed, force status to NotReady
    const requestedStatus = busAssignmentFields.Status || currentAssignment.Status;
    const allTrue = newBooleans.every(val => val === true);
    const isTargetStatus = [
      BusOperationStatus.NotStarted,
      BusOperationStatus.InOperation,
      BusOperationStatus.Completed,
    ].includes(requestedStatus as BusOperationStatus);

    if (isTargetStatus) {
      if (!allTrue) {
        busAssignmentFields.Status = BusOperationStatus.NotReady;
      }
      // else: all true, keep requested status
    }

    // If resetting from Completed (optional: if body.ResetCompleted is true)
    if (body.ResetCompleted) {
      booleanFields.forEach(field => (busAssignmentFields[field] = false as any));
      busAssignmentFields.Status = BusOperationStatus.NotReady;
    }

    const updatedBusAssignment = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: busAssignmentFields,
      include: { RegularBusAssignment: true },
    });

    // --- Handle LatestBusTripID management ---
    if (updatedBusAssignment.RegularBusAssignment) {
      const regID = updatedBusAssignment.RegularBusAssignment.RegularBusAssignmentID;

      // NotStarted or NotReady: LatestBusTripID must be null
      if (
        updatedBusAssignment.Status === BusOperationStatus.NotStarted ||
        updatedBusAssignment.Status === BusOperationStatus.NotReady
      ) {
        await prisma.regularBusAssignment.update({
          where: { RegularBusAssignmentID: regID },
          data: { LatestBusTripID: null },
        });
      }
      // Completed or InOperation: must have a value
      else if (
        updatedBusAssignment.Status === BusOperationStatus.Completed ||
        updatedBusAssignment.Status === BusOperationStatus.InOperation
      ) {
        // If not set, create a BusTrip and set as latest
        const latestBusTripID = updatedBusAssignment.RegularBusAssignment.LatestBusTripID;
        if (!latestBusTripID) {
          const newBusTripID = await generateFormattedID('BT');
          await prisma.busTrip.create({
            data: {
              BusTripID: newBusTripID,
              RegularBusAssignmentID: regID,
              DispatchedAt: new Date(),
              CompletedAt: updatedBusAssignment.Status === BusOperationStatus.Completed ? new Date() : null,
              Sales: null,
              ChangeFund: null,
            },
          });
          await prisma.regularBusAssignment.update({
            where: { RegularBusAssignmentID: regID },
            data: { LatestBusTripID: newBusTripID },
          });
        }
      }
      // If resetting Completed, set LatestBusTripID to null
      if (body.ResetCompleted) {
        await prisma.regularBusAssignment.update({
          where: { RegularBusAssignmentID: regID },
          data: { LatestBusTripID: null },
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