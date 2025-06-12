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
    }

    // If resetting from Completed (optional: if body.ResetCompleted is true)
    if (body.ResetCompleted) {
      booleanFields.forEach(field => (busAssignmentFields[field] = false as any));
      busAssignmentFields.Status = BusOperationStatus.NotReady;

      // Update assignment and clear LatestBusTripID, then return early
      const updatedBusAssignment = await prisma.busAssignment.update({
        where: { BusAssignmentID },
        data: busAssignmentFields,
        include: { RegularBusAssignment: true },
      });

      if (updatedBusAssignment.RegularBusAssignment) {
        await prisma.regularBusAssignment.update({
          where: { RegularBusAssignmentID: updatedBusAssignment.RegularBusAssignment.RegularBusAssignmentID },
          data: { LatestBusTripID: null },
        });
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
    }

    const updatedBusAssignment = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: busAssignmentFields,
      include: { RegularBusAssignment: true },
    });

    // --- Handle LatestBusTripID management ---
    let latestBusTripID: string | null = updatedBusAssignment.RegularBusAssignment?.LatestBusTripID ?? null;
    const regID = updatedBusAssignment.RegularBusAssignment?.RegularBusAssignmentID;

    // 1. If LatestBusTripID is in the body, set it on the RegularBusAssignment and use it
    if ('LatestBusTripID' in body && body.LatestBusTripID) {
      // Check if the given BusTripID exists in the database
      const existingBusTrip = await prisma.busTrip.findUnique({
        where: { BusTripID: body.LatestBusTripID }
      });
      if (!existingBusTrip) {
        return NextResponse.json({ error: 'Provided LatestBusTripID does not exist.' }, { status: 400 });
      }
      await prisma.regularBusAssignment.update({
        where: { RegularBusAssignmentID: regID },
        data: { LatestBusTripID: body.LatestBusTripID },
      });
      latestBusTripID = body.LatestBusTripID;
    }

    // 2. If not in body but exists in record, just use it (already set above)

    // 3. If not in body and record is null, create if all required fields are present
    if (!latestBusTripID) {
      const requiredFields = ['ChangeFund'];
      const missingFields = requiredFields.filter(f => !(f in body));
      if (
        'DispatchedAt' in body ||
        'Sales' in body ||
        'ChangeFund' in body ||
        'CompletedAt' in body
      ) {
        if (missingFields.length > 0) {
          return NextResponse.json({ error: `Missing required fields for BusTrip creation: ${missingFields.join(', ')}` }, { status: 400 });
        }
        if (!regID) {
          return NextResponse.json({ error: 'RegularBusAssignmentID is required to create a BusTrip.' }, { status: 400 });
        }
        const newBusTripID = await generateFormattedID('BT');
        await prisma.busTrip.create({
          data: {
            BusTripID: newBusTripID,
            RegularBusAssignmentID: regID,
            DispatchedAt: 'DispatchedAt' in body && body.DispatchedAt ? new Date(body.DispatchedAt) : null,
            CompletedAt: 'CompletedAt' in body && body.CompletedAt ? new Date(body.CompletedAt) : null,
            Sales: 'Sales' in body ? body.Sales : null,
            ChangeFund: body.ChangeFund,
          },
        });
        await prisma.regularBusAssignment.update({
          where: { RegularBusAssignmentID: regID },
          data: { LatestBusTripID: newBusTripID },
        });
        latestBusTripID = newBusTripID;
      }
      // If no BusTrip fields are present, skip BusTrip creation (no error)
    }

    // --- Update BusTrip fields if provided ---
    let targetBusTripID = latestBusTripID;
    if ('LatestBusTripID' in body && body.LatestBusTripID) {
      targetBusTripID = body.LatestBusTripID;
    }

    // Only show error if user tried to update BusTrip fields but no BusTrip exists
    const hasAnyBusTripField =
      'Sales' in body ||
      'ChangeFund' in body ||
      'DispatchedAt' in body ||
      'CompletedAt' in body;

    if (!targetBusTripID && hasAnyBusTripField) {
      return NextResponse.json({ error: 'No valid BusTrip to update or create' }, { status: 400 });
    }

    const busTripUpdate: any = {};
    if ('Sales' in body) busTripUpdate.Sales = body.Sales;
    if ('ChangeFund' in body) busTripUpdate.ChangeFund = body.ChangeFund;
    if ('DispatchedAt' in body) busTripUpdate.DispatchedAt = new Date(body.DispatchedAt);
    if ('CompletedAt' in body) busTripUpdate.CompletedAt = body.CompletedAt ? new Date(body.CompletedAt) : null;

    if (targetBusTripID && Object.keys(busTripUpdate).length > 0) {
      await prisma.busTrip.update({
        where: { BusTripID: targetBusTripID },
        data: busTripUpdate,
      });
    }

    // --- Update or create TicketBusTrips for this BusTrip ---
    if (targetBusTripID && Array.isArray(body.TicketBusTrips)) {
      // 1. Delete all existing TicketBusTrips for this BusTrip
      await prisma.ticketBusTrip.deleteMany({
        where: { BusTripID: targetBusTripID }
      });

      // 2. Create new TicketBusTrips from the request
      for (const tbt of body.TicketBusTrips) {
        // If all fields are undefined/null, skip (do not error)
        const allTicketFieldsNull =
          (tbt.TicketBusTripID === undefined || tbt.TicketBusTripID === null) &&
          (tbt.StartingIDNumber === undefined || tbt.StartingIDNumber === null) &&
          (tbt.EndingIDNumber === undefined || tbt.EndingIDNumber === null) &&
          (tbt.TicketTypeID === undefined || tbt.TicketTypeID === null);

        if (allTicketFieldsNull) {
          continue; // skip this entry
        }

        // Only require StartingIDNumber and TicketTypeID
        if (
          tbt.StartingIDNumber === undefined ||
          !tbt.TicketTypeID
        ) {
          return NextResponse.json(
            { error: 'StartingIDNumber and TicketTypeID are required to create a TicketBusTrip.' },
            { status: 400 }
          );
        }

        const newTicketBusTripID = await generateFormattedID('TBT');
        await prisma.ticketBusTrip.create({
          data: {
            TicketBusTripID: newTicketBusTripID,
            BusTripID: targetBusTripID,
            TicketTypeID: tbt.TicketTypeID,
            StartingIDNumber: tbt.StartingIDNumber,
            EndingIDNumber: tbt.EndingIDNumber ?? null,
          },
        });
      }

      // 3. Check readiness and ticket count
      const ticketCount = await prisma.ticketBusTrip.count({
        where: { BusTripID: targetBusTripID }
      });

      if (allTrue && ticketCount > 0) {
        await prisma.busAssignment.update({
          where: { BusAssignmentID },
          data: { Status: BusOperationStatus.NotStarted }
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