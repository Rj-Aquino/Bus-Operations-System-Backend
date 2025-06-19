import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';
import { delCache, CACHE_KEYS} from '@/lib/cache';

enum BusOperationStatus {
  NotStarted = 'NotStarted',
  InOperation = 'InOperation',
  NotReady = 'NotReady',
}

const ALLOWED_PAYMENT_METHODS = ['Reimbursement', 'Company_Cash'];

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

const booleanFields: (keyof BusAssignmentUpdateData)[] = [
  'Battery', 'Lights', 'Oil', 'Water', 'Break',
  'Air', 'Gas', 'Engine', 'TireCondition',
  'Self_Driver', 'Self_Conductor',
];

function getBusAssignmentFields(body: any): BusAssignmentUpdateData {
  const fields: BusAssignmentUpdateData = {};
  if (body.Status) fields.Status = body.Status;
  for (const field of booleanFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      fields[field] = body[field];
    }
  }
  return fields;
}

function getNewBooleans(fields: BusAssignmentUpdateData, current: any) {
  return booleanFields.map(field =>
    Object.prototype.hasOwnProperty.call(fields, field)
      ? !!fields[field]
      : !!current[field]
  );
}

function shouldForceNotReady(status: any, allTrue: boolean) {
  return (
    [BusOperationStatus.NotStarted, BusOperationStatus.InOperation].includes(status) &&
    !allTrue
  );
}

async function resetAssignment(BusAssignmentID: string, busAssignmentFields: BusAssignmentUpdateData, user: any) {
  booleanFields.forEach(field => (busAssignmentFields[field] = false as any));
  busAssignmentFields.Status = BusOperationStatus.NotReady;

  const updatedBusAssignment = await prisma.busAssignment.update({
    where: { BusAssignmentID },
    data: {
      ...busAssignmentFields,
      UpdatedBy: user?.employeeId || null,
    },
    include: { RegularBusAssignment: true },
  });

  if (updatedBusAssignment.RegularBusAssignment) {
    await prisma.regularBusAssignment.update({
      where: { RegularBusAssignmentID: updatedBusAssignment.RegularBusAssignment.RegularBusAssignmentID },
      data: { LatestBusTripID: null, UpdatedBy: user?.employeeId || null },
    });
  }

  return await fetchFullRecord(BusAssignmentID);
}

async function fetchFullRecord(BusAssignmentID: string) {
  return prisma.busAssignment.findUnique({
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
      CreatedAt: true,
      UpdatedAt: true,
      CreatedBy: true,
      UpdatedBy: true,
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
              Remarks: true,
              TripExpense: true,
              Payment_Method: true,
              TicketBusTrips: {
                select: {
                  TicketBusTripID: true,
                  StartingIDNumber: true,
                  EndingIDNumber: true,
                  OverallEndingID: true,
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
          CreatedAt: true,
          UpdatedAt: true,
          CreatedBy: true,
          UpdatedBy: true,
        },
      },
    },
  });
}

function applyAuditLogic(record: any) {
  let reg = record?.RegularBusAssignment;
  if (
    reg &&
    reg.CreatedAt &&
    reg.UpdatedAt &&
    new Date(reg.CreatedAt).getTime() === new Date(reg.UpdatedAt).getTime()
  ) {
    reg = { ...reg, UpdatedAt: null, UpdatedBy: null } as any;
  }
  let processedAssignment: any = record;
  if (
    record?.CreatedAt &&
    record?.UpdatedAt &&
    new Date(record.CreatedAt).getTime() === new Date(record.UpdatedAt).getTime()
  ) {
    processedAssignment = { ...record, UpdatedAt: null, UpdatedBy: null } as any;
  }
  return {
    ...processedAssignment,
    RegularBusAssignment: reg,
  };
}

async function handleBusTrip(
  body: any,
  regID: string | undefined,
  latestBusTripID: string | null,
  user: any
): Promise<string | null> {
  // 1. If LatestBusTripID is in the body, set it on the RegularBusAssignment and use it
  if ('LatestBusTripID' in body && body.LatestBusTripID) {
    const existingBusTrip = await prisma.busTrip.findUnique({
      where: { BusTripID: body.LatestBusTripID }
    });
    if (!existingBusTrip) throw new Error('Provided LatestBusTripID does not exist.');
    await prisma.regularBusAssignment.update({
      where: { RegularBusAssignmentID: regID },
      data: { LatestBusTripID: body.LatestBusTripID, UpdatedBy: user?.employeeId || null },
    });
    return body.LatestBusTripID;
  }

  // 3. If not in body and record is null, create if any BusTrip fields are present
  if (!latestBusTripID) {
    if (
      'DispatchedAt' in body ||
      'Sales' in body ||
      'ChangeFund' in body ||
      'CompletedAt' in body ||
      'Remarks' in body ||
      'TripExpense' in body ||
      'Payment_Method' in body 
    ) {
      if (!regID) throw new Error('RegularBusAssignmentID is required to create a BusTrip.');
      const newBusTripID = await generateFormattedID('BT');
      await prisma.busTrip.create({
        data: {
          BusTripID: newBusTripID,
          RegularBusAssignmentID: regID,
          DispatchedAt: 'DispatchedAt' in body && body.DispatchedAt ? new Date(body.DispatchedAt) : null,
          CompletedAt: 'CompletedAt' in body && body.CompletedAt ? new Date(body.CompletedAt) : null,
          Sales: 'Sales' in body ? body.Sales : null,
          ChangeFund: 'ChangeFund' in body ? body.ChangeFund : null,
          Remarks: 'Remarks' in body ? body.Remarks : null,
          TripExpense: 'TripExpense' in body ? body.TripExpense : null,
          Payment_Method: 'Payment_Method' in body ? body.Payment_Method : null,
          UpdatedBy: user?.employeeId || null,
        },
      });
      await prisma.regularBusAssignment.update({
        where: { RegularBusAssignmentID: regID },
        data: { LatestBusTripID: newBusTripID, UpdatedBy: user?.employeeId || null },
      });
      return newBusTripID;
    }
  }

  // 2. If not in body but exists in record, just use it (already set above)
  return latestBusTripID;
}

async function updateBusTripFields(targetBusTripID: string, body: any, user: any) {
  const busTripUpdate: any = {};
  if ('Sales' in body) busTripUpdate.Sales = body.Sales;
  if ('ChangeFund' in body) busTripUpdate.ChangeFund = body.ChangeFund;
  if ('DispatchedAt' in body) busTripUpdate.DispatchedAt = new Date(body.DispatchedAt);
  if ('CompletedAt' in body) busTripUpdate.CompletedAt = body.CompletedAt ? new Date(body.CompletedAt) : null;
  if ('Remarks' in body) busTripUpdate.Remarks = body.Remarks;
  if ('TripExpense' in body) busTripUpdate.TripExpense = body.TripExpense;
  if ('Payment_Method' in body) busTripUpdate.Payment_Method = body.Payment_Method;
  busTripUpdate.UpdatedBy = user?.employeeId || null;

  if (Object.keys(busTripUpdate).length > 0) {
    await prisma.busTrip.update({
      where: { BusTripID: targetBusTripID },
      data: busTripUpdate,
    });
  }
}

async function updateTicketBusTrips(targetBusTripID: string, ticketBusTrips: any[], allTrue: boolean, BusAssignmentID: string, user: any) {
  // 1. Delete all existing TicketBusTrips for this BusTrip
  await prisma.ticketBusTrip.deleteMany({
    where: { BusTripID: targetBusTripID }
  });

  // 2. Create new TicketBusTrips from the request (no required fields validation)
  for (const tbt of ticketBusTrips) {
    const newTicketBusTripID = await generateFormattedID('TBT');
    await prisma.ticketBusTrip.create({
      data: {
        TicketBusTripID: newTicketBusTripID,
        BusTripID: targetBusTripID,
        TicketTypeID: tbt.TicketTypeID,
        StartingIDNumber: tbt.StartingIDNumber ?? null,
        EndingIDNumber: tbt.EndingIDNumber ?? null,
        OverallEndingID: tbt.OverallEndingID ?? null,
        UpdatedBy: user?.employeeId || null,
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
      data: { Status: BusOperationStatus.NotStarted, UpdatedBy: user?.employeeId || null }
    });
  }
}

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

    // Validate Payment_Method if present
    if (
      'Payment_Method' in body &&
      body.Payment_Method != null &&
      !ALLOWED_PAYMENT_METHODS.includes(body.Payment_Method)
    ) {
      return NextResponse.json(
        { error: 'Invalid Payment_Method. Allowed values: Reimbursement, Company_Cash.' },
        { status: 400 }
      );
    }

    if (body.Status && !Object.values(BusOperationStatus).includes(body.Status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const busAssignmentFields = getBusAssignmentFields(body);

    // Fetch current assignment for logic
    const currentAssignment = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      include: { RegularBusAssignment: true },
    });

    if (!currentAssignment) {
      return NextResponse.json({ error: 'BusAssignment not found' }, { status: 404 });
    }

    const newBooleans = getNewBooleans(busAssignmentFields, currentAssignment);
    const requestedStatus = busAssignmentFields.Status || currentAssignment.Status;
    const allTrue = newBooleans.every(val => val === true);

    if (shouldForceNotReady(requestedStatus, allTrue)) {
      busAssignmentFields.Status = BusOperationStatus.NotReady;
    }

    // Only validate QuotaPolicy if status is InOperation (either in body or current)
    const statusToCheck = body.Status || currentAssignment.Status;
    if (statusToCheck === BusOperationStatus.InOperation) {
      let dispatchedAt: Date;
      if ('DispatchedAt' in body && body.DispatchedAt) {
        dispatchedAt = new Date(body.DispatchedAt);
      } else {
        dispatchedAt = new Date(); // Use current date/time if not provided
        body.DispatchedAt = dispatchedAt.toISOString(); // Add to body for downstream use
      }

      console.log('[QuotaPolicy Validation] DispatchedAt:', dispatchedAt.toISOString());
      console.log('[QuotaPolicy Validation] RegularBusAssignmentID:', currentAssignment.RegularBusAssignment?.RegularBusAssignmentID);

      if (currentAssignment.RegularBusAssignment?.RegularBusAssignmentID) {
        const hasPolicy = await prisma.quota_Policy.findFirst({
          where: {
            RegularBusAssignmentID: currentAssignment.RegularBusAssignment.RegularBusAssignmentID,
            StartDate: { lte: dispatchedAt },
            EndDate: { gte: dispatchedAt },
          },
          select: { QuotaPolicyID: true },
        });

        console.log('[QuotaPolicy Validation] Found Policy:', hasPolicy);

        if (!hasPolicy) {
          console.warn('[QuotaPolicy Validation] No active QuotaPolicy for this DispatchedAt!');
          return NextResponse.json(
            { error: 'Cannot dispatch: No active QuotaPolicy for the selected DispatchedAt date/time.' },
            { status: 400 }
          );
        }
      }
    }

    // Reset logic
    if (body.ResetCompleted) {
      const updatedFullRecord = await resetAssignment(BusAssignmentID, busAssignmentFields, user);
      await delCache(CACHE_KEYS.DASHBOARD ?? '');
      await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTREADY ?? '');
      await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTSTARTED ?? '');
      await delCache(CACHE_KEYS.BUS_OPERATIONS_INOPERATION ?? '');
      await delCache(CACHE_KEYS.BUS_OPERATIONS_ALL ?? '');
      return NextResponse.json(applyAuditLogic(updatedFullRecord), { status: 200 });
    }

    const updatedBusAssignment = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: {
        ...busAssignmentFields,
        UpdatedBy: user?.employeeId || null,
      },
      include: { RegularBusAssignment: true },
    });

    // --- Handle LatestBusTripID management ---
    const latestBusTripID: string | null = updatedBusAssignment.RegularBusAssignment?.LatestBusTripID ?? null;
    const regID = updatedBusAssignment.RegularBusAssignment?.RegularBusAssignmentID;

    let targetBusTripID: string | null = null;
    try {
      targetBusTripID = await handleBusTrip(body, regID, latestBusTripID, user);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Only show error if user tried to update BusTrip fields but no BusTrip exists
    const hasAnyBusTripField =
      'Sales' in body ||
      'ChangeFund' in body ||
      'DispatchedAt' in body ||
      'CompletedAt' in body ||
      'Remarks' in body ||
      'TripExpense' in body ||
      'Payment_Method' in body 

    if (!targetBusTripID && hasAnyBusTripField) {
      return NextResponse.json({ error: 'No valid BusTrip to update or create' }, { status: 400 });
    }

    if (targetBusTripID) {
      await updateBusTripFields(targetBusTripID, body, user);
    }

    if (targetBusTripID && Array.isArray(body.TicketBusTrips)) {
      await updateTicketBusTrips(targetBusTripID, body.TicketBusTrips, allTrue, BusAssignmentID, user);
    }

    const updatedFullRecord = await fetchFullRecord(BusAssignmentID);
    await delCache(CACHE_KEYS.DASHBOARD ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTREADY ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTSTARTED ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_INOPERATION ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_ALL ?? '');
    return NextResponse.json(applyAuditLogic(updatedFullRecord), { status: 200 });

  } catch (error: any) {
    console.error('Update error:', error);
    if (
      error.code === 'P2003' &&
      String(error.message).includes('TicketBusTripAssignment_TicketTypeID_fkey')
    ) {
      return NextResponse.json(
        { error: 'Invalid TicketTypeID: Ticket type does not exist.' },
        { status: 400 }
      );
    }
    if (
      error.code === 'P2000' &&
      String(error.message).includes('Payment_Method')
    ) {
      return NextResponse.json(
        { error: 'Invalid Payment_Method. Allowed values: Reimbursement, Company_Cash.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
};

export const PUT = withCors(putHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
