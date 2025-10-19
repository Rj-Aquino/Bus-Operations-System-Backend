import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { BusOperationStatus, RentalRequestStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { delCache, CACHE_KEYS } from '@/lib/cache';
import { generateFormattedID } from '@/lib/idGenerator';

const RENTAL_REQUESTS_CACHE_KEY = CACHE_KEYS.RENTAL_REQUESTS_ALL ?? '';

const putHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const url = new URL(request.url);
    const RentalRequestID = url.pathname.split('/').pop();
    if (!RentalRequestID)
      return NextResponse.json({ error: 'RentalRequestID is required in the URL' }, { status: 400 });

    const body = await request.json();
    const { command, rentalRequestUpdates, rentalAssignmentUpdates, busAssignmentUpdates, drivers } = body;

    // Fetch current state first
    const current = await prisma.rentalRequest.findUnique({
      where: { RentalRequestID },
      include: {
        RentalBusAssignment: {
          include: {
            BusAssignment: true,
            RentalDrivers: true,
          },
        },
      },
    });
    if (!current)
      return NextResponse.json({ error: 'RentalRequest not found' }, { status: 404 });

    const actor = user?.userId ?? 'SYSTEM';

    const allowedRBAFields = new Set([
      'Battery','Lights','Oil','Water','Break','Air','Gas','Engine','TireCondition','Note'
    ]);

    const allowedBAFields = new Set([
      'Battery','Lights','Oil','Water','Break','Air','Gas','Engine','TireCondition','Self_Driver','Status'
    ]);

    const findBAStatus = (val: any): BusOperationStatus | undefined => {
      if (!val) return undefined;
      const entries = Object.values(BusOperationStatus) as string[];
      if (entries.includes(val)) return val as BusOperationStatus;
      return entries.find(v => v.toLowerCase() === String(val).toLowerCase()) as BusOperationStatus | undefined;
    };

    // Main transaction
    const result = await prisma.$transaction(async (tx) => {
      const currentStatus = current.Status;

      /** ───────────────────────────────────────────────
       *  PENDING STATUS
       *  ─────────────────────────────────────────────── */
      if (currentStatus === RentalRequestStatus.Pending) {
        if (rentalRequestUpdates && Object.keys(rentalRequestUpdates).length > 0)
          throw new Error('Updating RentalRequest fields is not allowed while Pending');

        // Reject command
        if (command === 'reject') {
          const updated = await tx.rentalRequest.update({
            where: { RentalRequestID },
            data: {
              Status: RentalRequestStatus.Rejected,
              UpdatedBy: actor,
            },
            include: {
              RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } },
            },
          });
          return updated;
        }

        // Approve command
        if (command === 'approve') {
          const rba = current.RentalBusAssignment;
          if (!rba || !rba.BusAssignment)
            throw new Error('Cannot approve: no associated BusAssignment');

          await tx.rentalRequest.update({
            where: { RentalRequestID },
            data: { Status: RentalRequestStatus.Approved, UpdatedBy: actor },
          });

          await tx.busAssignment.update({
            where: { BusAssignmentID: rba.BusAssignment.BusAssignmentID },
            data: { Status: BusOperationStatus.NotReady, UpdatedBy: actor },
          });

          // Update BusAssignment fields if provided
          if (busAssignmentUpdates && typeof busAssignmentUpdates === 'object') {
            const baData: any = {};
            for (const key of Object.keys(busAssignmentUpdates)) {
              if (!allowedBAFields.has(key))
                throw new Error(`Field ${key} not allowed on BusAssignment update`);

              if (key === 'Status') {
                const found = findBAStatus(busAssignmentUpdates[key]);
                if (!found) throw new Error('Invalid BusAssignment Status');
                baData[key] = found;
              } else {
                baData[key] = busAssignmentUpdates[key];
              }
            }

            // Default Self_Conductor to true if not provided
            if (!('Self_Conductor' in baData)) {
              baData.Self_Conductor = true;
            }

            if (Object.keys(baData).length > 0) {
              baData.UpdatedBy = actor;
              await tx.busAssignment.update({
                where: { BusAssignmentID: rba.BusAssignment.BusAssignmentID },
                data: baData,
              });
            }
          }

          // Replace drivers if provided
          if (Array.isArray(drivers)) {
            await tx.rentalDriver.deleteMany({
              where: { RentalBusAssignmentID: rba.RentalBusAssignmentID },
            });
            for (const driverID of drivers) {
              const rdID = await generateFormattedID('RD');
              await tx.rentalDriver.create({
                data: {
                  RentalDriverID: rdID,
                  RentalBusAssignmentID: rba.RentalBusAssignmentID,
                  DriverID: String(driverID),
                  CreatedBy: actor,
                },
              });
            }
          }

          return await tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
          });
        }

        // Otherwise, return unchanged
        return current;
      }

      /** ───────────────────────────────────────────────
       *  COMPLETED / REJECTED: READ-ONLY
       *  ─────────────────────────────────────────────── */
      if (
        currentStatus === RentalRequestStatus.Completed ||
        currentStatus === RentalRequestStatus.Rejected
      ) {
        return current;
      }

      /** ───────────────────────────────────────────────
       *  APPROVED STATUS
       *  ─────────────────────────────────────────────── */
      if (currentStatus === RentalRequestStatus.Approved) {
        const rba = current.RentalBusAssignment;
        if (!rba || !rba.BusAssignment)
          throw new Error('No BusAssignment associated with this approved request');

        const ba = rba.BusAssignment;
        const baStatus = ba.Status as BusOperationStatus;

        // ───── Approved + NotReady ─────
        if (baStatus === BusOperationStatus.NotReady) {
          if (busAssignmentUpdates && typeof busAssignmentUpdates === 'object') {
            const baData: any = {};
            for (const key of Object.keys(busAssignmentUpdates)) {
              if (!allowedBAFields.has(key))
                throw new Error(`Field ${key} not allowed on BusAssignment update`);

              if (key === 'Status') {
                const found = findBAStatus(busAssignmentUpdates[key]);
                if (!found) throw new Error('Invalid BusAssignment Status');
                baData[key] = found;
              } else {
                baData[key] = busAssignmentUpdates[key];
              }
            }

            // Default Self_Conductor to true if not provided
            if (!('Self_Conductor' in baData)) {
              baData.Self_Conductor = true;
            }

            if (Object.keys(baData).length > 0) {
              baData.UpdatedBy = actor;
              await tx.busAssignment.update({
                where: { BusAssignmentID: ba.BusAssignmentID },
                data: baData,
              });
            }
          }

          const readinessFields = [
            'Battery','Lights','Oil','Water','Break','Air','Gas','Engine','TireCondition','Self_Driver'
          ];

          const updates = busAssignmentUpdates ?? {};
          const hasFalse = readinessFields.some(field => updates[field] === false);
          const allTrue = readinessFields.every(field => updates[field] === true);
          const driverCount = Array.isArray(drivers) ? drivers.length : 0;

          // Require exactly 2 drivers
          if (driverCount !== 2) {
            throw new Error(`Cannot proceed: exactly 2 drivers required (found ${driverCount}).`);
          }

          // Replace drivers if provided
          if (Array.isArray(drivers)) {
            await tx.rentalDriver.deleteMany({
              where: { RentalBusAssignmentID: rba.RentalBusAssignmentID },
            });
            for (const driverID of drivers) {
              const rdID = await generateFormattedID('RD');
              await tx.rentalDriver.create({
                data: {
                  RentalDriverID: rdID,
                  RentalBusAssignmentID: rba.RentalBusAssignmentID,
                  DriverID: String(driverID),
                  CreatedBy: actor,
                },
              });
            }
          }

          // ✅ Move to NotStarted only if all readiness fields true AND 2 drivers
          if (allTrue && driverCount === 2) {
            await tx.busAssignment.update({
              where: { BusAssignmentID: ba.BusAssignmentID },
              data: { Status: BusOperationStatus.NotStarted, UpdatedBy: actor },
            });
          }

          // Always return the latest updated request
          return await tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: {
              RentalBusAssignment: {
                include: { BusAssignment: true, RentalDrivers: true },
              },
            },
          });
        }

        // ───── Approved + NotStarted ─────
        if (baStatus === BusOperationStatus.NotStarted) {
          if (command === 'toInOperation' || (busAssignmentUpdates && 'Status' in busAssignmentUpdates)) {
            const target = command === 'toInOperation'
              ? BusOperationStatus.InOperation
              : findBAStatus(busAssignmentUpdates.Status);

            if (!target || target !== BusOperationStatus.InOperation)
              throw new Error('When NotStarted, only transition to InOperation is permitted');

            await tx.busAssignment.update({
              where: { BusAssignmentID: ba.BusAssignmentID },
              data: { Status: BusOperationStatus.InOperation, UpdatedBy: actor },
            });
          } else {
            throw new Error('Only Status transition to InOperation allowed when BusAssignment is NotStarted');
          }

          return await tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
          });
        }

        // ───── Approved + InOperation ─────
        if (baStatus === BusOperationStatus.InOperation) {
          if (rentalAssignmentUpdates && typeof rentalAssignmentUpdates === 'object') {
            const data: any = {};
            for (const key of Object.keys(rentalAssignmentUpdates)) {
              if (!allowedRBAFields.has(key))
                throw new Error(`Field ${key} not allowed on RentalBusAssignment update`);
              data[key] = rentalAssignmentUpdates[key];
            }

            if (Object.keys(data).length > 0) {
              data.UpdatedBy = actor;
              await tx.rentalBusAssignment.update({
                where: { RentalBusAssignmentID: rba.RentalBusAssignmentID },
                data,
              });
            }
          }

          if (command === 'complete') {
            await tx.rentalRequest.update({
              where: { RentalRequestID },
              data: { Status: RentalRequestStatus.Completed, UpdatedBy: actor },
            });

            return await tx.rentalRequest.findUnique({
              where: { RentalRequestID },
              include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
            });
          }

          throw new Error('Only "complete" command allowed when BusAssignment is InOperation');
        }

        throw new Error('BusAssignment updates not allowed for current BusAssignment status');
      }

      // Default fallback
      return current;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('UPDATE_RENTAL_REQUEST_ERROR', err);
    try { console.error(JSON.stringify(err, Object.getOwnPropertyNames(err))); } catch {}
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update rental request' },
      { status: 500 }
    );
  }
};

const patchHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const RentalRequestID = url.pathname.split('/').pop();

    if (!RentalRequestID) {
      return NextResponse.json({ error: 'RentalRequestID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { IsDeleted } = body;

    if (typeof IsDeleted !== 'boolean') {
      return NextResponse.json({ error: '`IsDeleted` must be a boolean' }, { status: 400 });
    }

    const updated = await prisma.rentalRequest.update({
      where: { RentalRequestID },
      data: {
        IsDeleted,
        UpdatedBy: user?.userId || null,
      },
      select: {
        RentalRequestID: true,
        IsDeleted: true,
        UpdatedBy: true,
        UpdatedAt: true,
      },
    });

    // Invalidate cache
    //await delCache(RENTAL_REQUESTS_CACHE_KEY);

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('PATCH_RENTAL_REQUEST_ERROR', error);
    return NextResponse.json({ error: 'Failed to update rental request' }, { status: 500 });
  }
};

export const PUT = withCors(putHandler);
export const PATCH = withCors(patchHandler);

export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
