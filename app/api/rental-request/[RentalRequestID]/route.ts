import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { BusOperationStatus, RentalRequestStatus, DamageReportStatus } from '@prisma/client';
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
      'Battery', 'Lights', 'Oil', 'Water', 'Brake', 'Air', 'Gas', 'Engine', 'TireCondition', 'Note',
    ]);

    const allowedBAFields = new Set([
      'Battery', 'Lights', 'Oil', 'Water', 'Brake', 'Air', 'Gas', 'Engine', 'TireCondition', 'Self_Driver', 'Status',
    ]);

    const findBAStatus = (val: any): BusOperationStatus | undefined => {
      if (!val) return undefined;
      const entries = Object.values(BusOperationStatus) as string[];
      if (entries.includes(val)) return val as BusOperationStatus;
      return entries.find(v => v.toLowerCase() === String(val).toLowerCase()) as BusOperationStatus | undefined;
    };

    // 🔹 Main Transaction
    const result = await prisma.$transaction(async (tx) => {
      const currentStatus = current.Status;
      const rba = current.RentalBusAssignment;
      const busAssignment = rba?.BusAssignment;

      // ========== PENDING ==========
      if (currentStatus === RentalRequestStatus.Pending) {
        const allowedApproveFields = [
          'DownPaymentAmount',
          'BalanceAmount',
          'DownPaymentDate',
          'FullPaymentDate',
        ];
        const allowedRejectFields = ['CancelledAtDate', 'CancelledReason'];

        const isApprove = command === 'approve';
        const isReject = command === 'reject';

        // ⚠️ Block updates unless they are part of approve/reject commands
        if (rentalRequestUpdates && Object.keys(rentalRequestUpdates).length > 0) {
          const allowedFields = isApprove
            ? allowedApproveFields
            : isReject
            ? allowedRejectFields
            : [];

          const hasInvalidFields = Object.keys(rentalRequestUpdates).some(
            (key) => !allowedFields.includes(key)
          );

          if (hasInvalidFields) {
            throw new Error('Updating RentalRequest fields is not allowed while Pending');
          }
        }

        // =======================
        // ✅ APPROVE LOGIC
        // =======================
        if (isApprove) {
          if (!rba || !busAssignment)
            throw new Error('Cannot approve: no associated BusAssignment');

          // ✅ Always update provided fields (partial allowed)
          await tx.rentalRequest.update({
            where: { RentalRequestID },
            data: {
              ...rentalRequestUpdates,
              UpdatedBy: actor,
            },
          });

          // 🔍 Recheck current record after update
          const updatedRequest = await tx.rentalRequest.findUnique({
            where: { RentalRequestID },
            select: {
              DownPaymentAmount: true,
              BalanceAmount: true,
              DownPaymentDate: true,
              FullPaymentDate: true,
            },
          });

          const allPaymentsProvided =
            updatedRequest?.DownPaymentAmount != null &&
            updatedRequest?.BalanceAmount != null &&
            updatedRequest?.DownPaymentDate != null &&
            updatedRequest?.FullPaymentDate != null;

          if (allPaymentsProvided) {
            // ✅ Move to Approved + BusAssignment → NotReady
            await tx.rentalRequest.update({
              where: { RentalRequestID },
              data: { Status: RentalRequestStatus.Approved, UpdatedBy: actor },
            });

            await tx.busAssignment.update({
              where: { BusAssignmentID: busAssignment.BusAssignmentID },
              data: { Status: BusOperationStatus.NotReady, UpdatedBy: actor },
            });
          }
        }

        // =======================
        // ❌ REJECT LOGIC
        // =======================
        else if (isReject) {
          const cancelReason = rentalRequestUpdates?.CancelledReason || 'No reason provided';
          const cancelDate =
            rentalRequestUpdates?.CancelledAtDate
              ? new Date(rentalRequestUpdates.CancelledAtDate)
              : new Date();

          await tx.rentalRequest.update({
            where: { RentalRequestID },
            data: {
              Status: RentalRequestStatus.Rejected,
              CancelledReason: cancelReason,
              CancelledAtDate: cancelDate,
              UpdatedBy: actor,
            },
          });
        }

        return tx.rentalRequest.findUnique({
          where: { RentalRequestID },
          include: { RentalBusAssignment: { include: { BusAssignment: true, RentalDrivers: true } } },
        });
      }

      // ========== APPROVED ==========
      if (currentStatus === RentalRequestStatus.Approved && rba && busAssignment) {
        const baStatus = busAssignment.Status as BusOperationStatus;
        const readinessFields = [
          'Battery', 'Lights', 'Oil', 'Water', 'Brake', 'Air', 'Gas', 'Engine', 'TireCondition', 'Self_Driver',
        ];

        // Approved + NotReady
        if (baStatus === BusOperationStatus.NotReady) {
          if (busAssignmentUpdates) {
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
            baData.UpdatedBy = actor;
            await tx.busAssignment.update({ where: { BusAssignmentID: busAssignment.BusAssignmentID }, data: baData });
          }

          const updates = busAssignmentUpdates ?? {};
          const allTrue = readinessFields.every(f => updates[f] === true);
          const driverCount = Array.isArray(drivers) ? drivers.length : 0;
          if (driverCount !== 2) throw new Error(`Exactly 2 drivers required (found ${driverCount})`);

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

          if (allTrue && driverCount === 2) {
            await tx.busAssignment.update({
              where: { BusAssignmentID: busAssignment.BusAssignmentID },
              data: { Status: BusOperationStatus.NotStarted, UpdatedBy: actor },
            });
          }
        }

        // Approved + NotStarted
        if (baStatus === BusOperationStatus.NotStarted) {
          if (command === 'toInOperation') {
            await tx.busAssignment.update({
              where: { BusAssignmentID: busAssignment.BusAssignmentID },
              data: { Status: BusOperationStatus.InOperation, UpdatedBy: actor },
            });
          } else {
            throw new Error('Only transition to InOperation allowed from NotStarted');
          }
        }

        // Approved + InOperation
        if (baStatus === BusOperationStatus.InOperation) {
          if (command === 'complete') {
            await tx.rentalRequest.update({
              where: { RentalRequestID },
              data: { Status: RentalRequestStatus.Completed, UpdatedBy: actor },
            });

            if (rentalRequestUpdates?.damageReport) {
              const { vehicleCondition, note, checkDate } = rentalRequestUpdates.damageReport;
              const DamageReportID = await generateFormattedID('DR');
              const damageData: any = {
                DamageReportID,
                BusAssignmentID: busAssignment.BusAssignmentID,
                Note: note || null,
                CheckDate: checkDate ? new Date(checkDate) : new Date(),
                CreatedBy: actor,
              };

              const fields = ['Battery', 'Lights', 'Oil', 'Water', 'Brake', 'Air', 'Gas', 'Engine', 'TireCondition'];
              for (const field of fields) {
                damageData[field] = vehicleCondition?.[field] ?? false;
              }

              const allOk = fields.every(f => damageData[f] === true);
              damageData.Status = allOk ? DamageReportStatus.NA : DamageReportStatus.Pending;

              await tx.damageReport.create({ data: damageData });
            }
          } else {
            throw new Error('Only "complete" command allowed while InOperation');
          }
        }

        return tx.rentalRequest.findUnique({
          where: { RentalRequestID },
          include: {
            RentalBusAssignment: {
              include: { BusAssignment: true, RentalDrivers: true },
            },
          },
        });
      }

      // ========== COMPLETED ==========
      if (currentStatus === RentalRequestStatus.Completed && rba && busAssignment) {
        if (rentalRequestUpdates?.damageReport) {
          const { vehicleCondition, note, checkDate } = rentalRequestUpdates.damageReport;
          const DamageReportID = await generateFormattedID('DR');

          const damageData: any = {
            DamageReportID,
            BusAssignmentID: busAssignment.BusAssignmentID,
            Note: note || null,
            CheckDate: checkDate ? new Date(checkDate) : new Date(),
            CreatedBy: actor,
          };

          const fields = ['Battery', 'Lights', 'Oil', 'Water', 'Brake', 'Air', 'Gas', 'Engine', 'TireCondition'];
          for (const field of fields) {
            damageData[field] = vehicleCondition?.[field] ?? false;
          }

          const allOk = fields.every(f => damageData[f] === true);
          damageData.Status = allOk ? DamageReportStatus.NA : DamageReportStatus.Pending;

          await tx.damageReport.create({ data: damageData });
        }

        return tx.rentalRequest.findUnique({
          where: { RentalRequestID },
          include: {
            RentalBusAssignment: {
              include: {
                BusAssignment: { include: { DamageReports: true } },
                RentalDrivers: true,
              },
            },
          },
        });
      }

      return current;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('UPDATE_RENTAL_REQUEST_ERROR', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update rental request' },
      { status: 500 },
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
