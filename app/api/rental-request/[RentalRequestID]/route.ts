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
    if (!RentalRequestID) return NextResponse.json({ error: 'RentalRequestID is required in the URL' }, { status: 400 });

    const body = await request.json();
    const { command, rentalRequestUpdates, rentalAssignmentUpdates, busAssignmentUpdates, drivers } = body;

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
    if (!current) return NextResponse.json({ error: 'RentalRequest not found' }, { status: 404 });

    const actor = user?.userId ?? null;

    const allowedRBAFields = new Set([
      'Battery','Lights','Oil','Water','Break','Air','Gas','Engine','TireCondition','Note'
    ]);

    const allowedBAFields = new Set([
      'Battery','Lights','Oil','Water','Break','Air','Gas','Engine','TireCondition','Self_Driver','Self_Conductor','Status'
    ]);

    const findBAStatus = (val: any): BusOperationStatus | undefined => {
      if (!val) return undefined;
      const entries = Object.values(BusOperationStatus) as string[];
      if (entries.includes(val)) return val as BusOperationStatus;
      return entries.find(v => v.toLowerCase() === String(val).toLowerCase()) as BusOperationStatus | undefined;
    };

    const result = await prisma.$transaction(async (tx) => {
      const currentStatus = current.Status;

      // PENDING: Only "approve" or "reject" commands allowed.
      if (currentStatus === RentalRequestStatus.Pending) {
        if (rentalRequestUpdates && Object.keys(rentalRequestUpdates).length > 0) {
          return Promise.reject(new Error('Updating RentalRequest fields is not allowed while Pending'));
        }

        if (command === 'approve') {
          const rba = current.RentalBusAssignment;
          if (!rba || !rba.BusAssignment) return Promise.reject(new Error('Cannot approve: no associated BusAssignment'));

          await tx.rentalRequest.update({
            where: { RentalRequestID },
            data: { Status: RentalRequestStatus.Approved, UpdatedBy: actor },
          });

          await tx.busAssignment.update({
            where: { BusAssignmentID: rba.BusAssignment.BusAssignmentID },
            data: { Status: BusOperationStatus.NotReady, UpdatedBy: actor },
          });

          // optional: allow busAssignmentUpdates & drivers under Approved+NotReady rules (rentalAssignmentUpdates NOT allowed here)
          if (busAssignmentUpdates && typeof busAssignmentUpdates === 'object') {
            const baData: any = {};
            for (const key of Object.keys(busAssignmentUpdates)) {
              if (!allowedBAFields.has(key)) return Promise.reject(new Error(`Field ${key} not allowed on BusAssignment update`));
              if (key === 'Status') {
                const found = findBAStatus(busAssignmentUpdates[key]);
                if (!found) return Promise.reject(new Error('Invalid BusAssignment Status'));
                baData[key] = found;
              } else {
                baData[key] = busAssignmentUpdates[key];
              }
            }
            if (Object.keys(baData).length > 0) {
              baData.UpdatedBy = actor;
              await tx.busAssignment.update({ where: { BusAssignmentID: rba.BusAssignment.BusAssignmentID }, data: baData });
            }
          }

          if (Array.isArray(drivers)) {
            await tx.rentalDriver.deleteMany({ where: { RentalBusAssignmentID: rba.RentalBusAssignmentID } });
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

          return tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
          });
        } else if (command === 'reject') {
          await tx.rentalRequest.update({
            where: { RentalRequestID },
            data: { Status: RentalRequestStatus.Rejected, UpdatedBy: actor },
          });

          return tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
          });
        } else {
          return tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
          });
        }
      }

      // COMPLETED: allow damage report creation only
      if (currentStatus === RentalRequestStatus.Completed) {
        const rba = current.RentalBusAssignment;
        if (!rba) return Promise.reject(new Error('No RentalBusAssignment found for this completed request'));

        // Only allow damage report creation for completed rentals
        if (rentalRequestUpdates && rentalRequestUpdates.damageReport) {
          const { vehicleCondition, note, checkDate } = rentalRequestUpdates.damageReport;
          const DamageReportID = await generateFormattedID('DR');

          const damageData: any = {
            DamageReportID,
            RentalRequestID,
            RentalBusAssignmentID: rba.RentalBusAssignmentID,
            Note: note || null,
            CheckDate: checkDate ? new Date(checkDate) : new Date(),
            CreatedBy: actor,
          };

          // Map vehicle condition object to individual boolean fields
          if (vehicleCondition && typeof vehicleCondition === 'object') {
            damageData.Battery = vehicleCondition.Battery || false;
            damageData.Lights = vehicleCondition.Lights || false;
            damageData.Oil = vehicleCondition.Oil || false;
            damageData.Water = vehicleCondition.Water || false;
            damageData.Brake = vehicleCondition.Brake || false;
            damageData.Air = vehicleCondition.Air || false;
            damageData.Gas = vehicleCondition.Gas || false;
            damageData.Engine = vehicleCondition.Engine || false;
            damageData.TireCondition = vehicleCondition['Tire Condition'] || false;
          }

          // Auto-assign status based on damage items
          // Note: false = damaged/issue found, true = no damage/OK
          // If ALL items are true (all OK), set status to NA (no damage found)
          // If ANY item is false (has damage), set status to Pending (needs review)
          const allItemsOk = damageData.Battery && damageData.Lights && damageData.Oil && 
                             damageData.Water && damageData.Brake && damageData.Air && 
                             damageData.Gas && damageData.Engine && damageData.TireCondition;
          
          damageData.Status = allItemsOk ? 'NA' : 'Pending';

          await tx.damageReport.create({ data: damageData });

          return tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: { 
              RentalBusAssignment: { 
                include: { 
                  BusAssignment: true, 
                  RentalDrivers: true,
                  DamageReports: true
                } 
              },
              DamageReports: true
            },
          });
        }

        // If no damage report provided, just return current state
        return tx.rentalRequest.findUnique({
          where: { RentalRequestID },
          include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true, DamageReports: true } }, DamageReports: true },
        });
      }

      // APPROVED: behavior depends on BusAssignment.Status
      if (currentStatus === RentalRequestStatus.Approved) {
        const rba = current.RentalBusAssignment;
        if (!rba || !rba.BusAssignment) return Promise.reject(new Error('No BusAssignment associated with this approved request'));

        const ba = rba.BusAssignment;
        const baStatus = ba.Status as BusOperationStatus;

        // Approved + NotReady: allow busAssignmentUpdates and driver replacement (rentalAssignmentUpdates NOT allowed)
        if (baStatus === BusOperationStatus.NotReady) {
          if (busAssignmentUpdates && typeof busAssignmentUpdates === 'object') {
            const baData: any = {};
            for (const key of Object.keys(busAssignmentUpdates)) {
              if (!allowedBAFields.has(key)) return Promise.reject(new Error(`Field ${key} not allowed on BusAssignment update`));
              if (key === 'Status') {
                const found = findBAStatus(busAssignmentUpdates[key]);
                if (!found) return Promise.reject(new Error('Invalid BusAssignment Status'));
                baData[key] = found;
              } else {
                baData[key] = busAssignmentUpdates[key];
              }
            }
            if (Object.keys(baData).length > 0) {
              baData.UpdatedBy = actor;
              await tx.busAssignment.update({ where: { BusAssignmentID: ba.BusAssignmentID }, data: baData });
            }
          }

          if (command === 'toNotStarted') {
            await tx.busAssignment.update({
              where: { BusAssignmentID: ba.BusAssignmentID },
              data: { Status: BusOperationStatus.NotStarted, UpdatedBy: actor },
            });
          }

          if (Array.isArray(drivers)) {
            await tx.rentalDriver.deleteMany({ where: { RentalBusAssignmentID: rba.RentalBusAssignmentID } });
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

          return tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
          });
        }

        // Approved + NotStarted: only allow transition to InOperation
        if (baStatus === BusOperationStatus.NotStarted) {
          if (command === 'toInOperation' || (busAssignmentUpdates && 'Status' in busAssignmentUpdates)) {
            const target = command === 'toInOperation' ? BusOperationStatus.InOperation : findBAStatus(busAssignmentUpdates.Status);
            if (!target || target !== BusOperationStatus.InOperation) return Promise.reject(new Error('When NotStarted only transition to InOperation is permitted'));
            await tx.busAssignment.update({ where: { BusAssignmentID: ba.BusAssignmentID }, data: { Status: BusOperationStatus.InOperation, UpdatedBy: actor } });
          } else {
            return Promise.reject(new Error('Only Status transition to InOperation allowed when BusAssignment is NotStarted'));
          }

          return tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
          });
        }

        // Approved + InOperation: allow rentalAssignmentUpdates while InOperation and allow "complete"
        if (baStatus === BusOperationStatus.InOperation) {
          // allow updating RentalBusAssignment booleans/note during InOperation
          if (rentalAssignmentUpdates && typeof rentalAssignmentUpdates === 'object') {
            const data: any = {};
            for (const key of Object.keys(rentalAssignmentUpdates)) {
              if (!allowedRBAFields.has(key)) return Promise.reject(new Error(`Field ${key} not allowed on RentalBusAssignment update`));
              data[key] = rentalAssignmentUpdates[key];
            }
            if (Object.keys(data).length > 0) {
              data.UpdatedBy = actor;
              await tx.rentalBusAssignment.update({ where: { RentalBusAssignmentID: rba.RentalBusAssignmentID }, data });
            }
          }

          if (command === 'complete' || command === 'updateStatus') {
            // Update the rental request status to Completed
            await tx.rentalRequest.update({ where: { RentalRequestID }, data: { Status: RentalRequestStatus.Completed, UpdatedBy: actor } });

            // If damage report data is provided, create a damage report
            if (rentalRequestUpdates && rentalRequestUpdates.damageReport) {
              const { vehicleCondition, note, checkDate } = rentalRequestUpdates.damageReport;
              const DamageReportID = await generateFormattedID('DR');

              const damageData: any = {
                DamageReportID,
                RentalRequestID,
                RentalBusAssignmentID: rba.RentalBusAssignmentID,
                Note: note || null,
                CheckDate: checkDate ? new Date(checkDate) : new Date(),
                CreatedBy: actor,
              };

              // Map vehicle condition object to individual boolean fields
              if (vehicleCondition && typeof vehicleCondition === 'object') {
                damageData.Battery = vehicleCondition.Battery || false;
                damageData.Lights = vehicleCondition.Lights || false;
                damageData.Oil = vehicleCondition.Oil || false;
                damageData.Water = vehicleCondition.Water || false;
                damageData.Brake = vehicleCondition.Brake || false;
                damageData.Air = vehicleCondition.Air || false;
                damageData.Gas = vehicleCondition.Gas || false;
                damageData.Engine = vehicleCondition.Engine || false;
                damageData.TireCondition = vehicleCondition['Tire Condition'] || false;
              }

              await tx.damageReport.create({ data: damageData });
            }

            return tx.rentalRequest.findUnique({
              where: { RentalRequestID },
              include: { 
                RentalBusAssignment: { 
                  include: { 
                    BusAssignment: true, 
                    RentalDrivers: true,
                    DamageReports: true
                  } 
                },
                DamageReports: true
              },
            });
          }

          return Promise.reject(new Error('Only "complete" command allowed when BusAssignment is InOperation'));
        }

        return Promise.reject(new Error('BusAssignment updates not allowed for current BusAssignment status'));
      }

      return current;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('UPDATE_RENTAL_REQUEST_ERROR', err);
    try { console.error(JSON.stringify(err, Object.getOwnPropertyNames(err))); } catch {}
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update rental request' }, { status: 500 });
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
