import prisma from '@/client';
import { RentalRequestStatus, BusOperationStatus, DamageReportStatus } from '@prisma/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { fetchBuses, fetchNewBuses } from '@/lib/fetchExternal';
import { delCache, CACHE_KEYS } from '@/lib/cache';

const RENTAL_REQUESTS_CACHE_KEY = CACHE_KEYS.RENTAL_REQUESTS_ALL ?? '';

export class RentalRequestService {
  private normalizeStatusInput(val?: string): RentalRequestStatus | undefined {
    if (!val) return undefined;
    const valid = ['Pending','Approved','Rejected','Completed'];
    const found = valid.find(s => s.toLowerCase() === String(val).toLowerCase());
    return found as RentalRequestStatus | undefined;
  }

  async getRentalRequests(statusParam?: string): Promise<any[]> {
    const where: any = { IsDeleted: false };
    const normalized = this.normalizeStatusInput(statusParam);
    if (normalized) where.Status = normalized;

    const includeClause: any = normalized === 'Approved' || normalized === 'Completed'
      ? {
          RentalBusAssignment: {
            include: {
              BusAssignment: {
                include: { DamageReports: { orderBy: { CheckDate: 'desc' }, take: 1 } },
              },
              RentalDrivers: { select: { RentalDriverID: true, DriverID: true, CreatedAt: true } },
            },
          },
        }
      : { RentalBusAssignment: { include: { BusAssignment: true } } };

    const rentalRequests = await prisma.rentalRequest.findMany({
      where,
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      include: includeClause,
    });

    // fetch bus data (new -> fallback)
    let buses: any[] = [];
    try {
      const nb = await fetchNewBuses();
      buses = Array.isArray(nb) && nb.length ? nb : (await fetchBuses().catch(() => [])) || [];
    } catch {
      buses = [];
    }
    const busMap = new Map((buses ?? []).map((b: any) => [String(b.bus_id), b]));

    // enrich and normalize timestamps
    return (rentalRequests ?? []).map((rr: any) => {
      const rba = rr.RentalBusAssignment;
      const ba = rba?.BusAssignment;
      const busID = ba?.BusID ? String(ba.BusID) : undefined;
      const busInfo = busID ? busMap.get(busID) : undefined;
      const enriched = {
        ...rr,
        BusType: busInfo?.bus_type ?? null,
        PlateNumber: busInfo?.plate_number ?? null,
        SeatCapacity: busInfo?.seat_capacity ?? null,
      };
      const created = enriched.CreatedAt ? new Date(enriched.CreatedAt) : null;
      const updated = enriched.UpdatedAt ? new Date(enriched.UpdatedAt) : null;
      if (created && updated && created.getTime() === updated.getTime()) {
        return { ...enriched, UpdatedAt: null, UpdatedBy: null };
      }
      return enriched;
    });
  }

  async createRentalRequest(body: any, actor: string | null) {
    // minimal validation (caller should validate more)
    const {
      PickupLocation, DropoffLocation, DistanceKM, TotalRentalAmount,
      NumberOfPassengers, RentalDate, Duration, CustomerName,
      CustomerContact, BusID, RouteName, Status, SpecialRequirements,
    } = body ?? {};

    if (!PickupLocation || !DropoffLocation || DistanceKM == null || TotalRentalAmount == null ||
        NumberOfPassengers == null || !RentalDate || Duration == null || !CustomerName ||
        !CustomerContact || !BusID || !RouteName) {
      throw new Error('Missing required fields');
    }

    const parsedRentalDate = new Date(RentalDate);
    if (isNaN(parsedRentalDate.getTime())) throw new Error('Invalid RentalDate');

    const normalizedStatus = this.normalizeStatusInput(Status) ?? 'Pending';

    const baID = await generateFormattedID('BA');
    const rrID = await generateFormattedID('RR');

    const created = await prisma.$transaction(async tx => {
      await tx.busAssignment.create({
        data: { BusAssignmentID: baID, BusID: String(BusID), AssignmentType: 'Rental', CreatedBy: actor },
      });

      await tx.rentalBusAssignment.create({
        data: { RentalBusAssignmentID: baID, CreatedBy: actor },
      });

      const rr = await tx.rentalRequest.create({
        data: {
          RentalRequestID: rrID,
          RentalBusAssignmentID: baID,
          RouteName: String(RouteName),
          PickupLocation: String(PickupLocation),
          DropoffLocation: String(DropoffLocation),
          DistanceKM: Number(DistanceKM),
          TotalRentalAmount: Number(TotalRentalAmount),
          NumberOfPassengers: Number(NumberOfPassengers),
          RentalDate: parsedRentalDate,
          Duration: Number(Duration),
          SpecialRequirements: SpecialRequirements ?? null,
          Status: normalizedStatus,
          CustomerName: String(CustomerName),
          CustomerContact: String(CustomerContact),
          CreatedBy: actor,
        },
        include: {
          RentalBusAssignment: {
            include: { BusAssignment: { select: { BusAssignmentID: true, BusID: true, AssignmentType: true, Status: true } } },
          },
        },
      });

      return rr;
    });

    // invalidate cache if used
    await delCache(RENTAL_REQUESTS_CACHE_KEY);
    return created;
  }

   async updateRentalRequest(RentalRequestID: string, body: any, actor: string | null) {
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
    if (!current) throw new Error('RentalRequest not found');

    const actorId = actor ?? 'SYSTEM';

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

    const {
      command,
      rentalRequestUpdates,
      rentalAssignmentUpdates, // not used currently but kept for compatibility
      busAssignmentUpdates,
      drivers,
    } = body ?? {};

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

        if (rentalRequestUpdates && Object.keys(rentalRequestUpdates).length > 0) {
          const allowedFields = isApprove ? allowedApproveFields : isReject ? allowedRejectFields : [];
          const hasInvalidFields = Object.keys(rentalRequestUpdates).some((key) => !allowedFields.includes(key));
          if (hasInvalidFields) throw new Error('Updating RentalRequest fields is not allowed while Pending');
        }

        // APPROVE
        if (isApprove) {
          if (!rba || !busAssignment) throw new Error('Cannot approve: no associated BusAssignment');

          await tx.rentalRequest.update({
            where: { RentalRequestID },
            data: { ...rentalRequestUpdates, UpdatedBy: actorId },
          });

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
            await tx.rentalRequest.update({
              where: { RentalRequestID },
              data: { Status: RentalRequestStatus.Approved, UpdatedBy: actorId },
            });

            await tx.busAssignment.update({
              where: { BusAssignmentID: busAssignment.BusAssignmentID },
              data: { Status: BusOperationStatus.NotReady, UpdatedBy: actorId },
            });
          }
        }
        // REJECT
        else if (isReject) {
          const cancelReason = rentalRequestUpdates?.CancelledReason || 'No reason provided';
          const cancelDate =
            rentalRequestUpdates?.CancelledAtDate ? new Date(rentalRequestUpdates.CancelledAtDate) : new Date();

          await tx.rentalRequest.update({
            where: { RentalRequestID },
            data: {
              Status: RentalRequestStatus.Rejected,
              CancelledReason: cancelReason,
              CancelledAtDate: cancelDate,
              UpdatedBy: actorId,
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
              if (!allowedBAFields.has(key)) throw new Error(`Field ${key} not allowed on BusAssignment update`);
              if (key === 'Status') {
                const found = findBAStatus(busAssignmentUpdates[key]);
                if (!found) throw new Error('Invalid BusAssignment Status');
                baData[key] = found;
              } else {
                baData[key] = busAssignmentUpdates[key];
              }
            }
            baData.UpdatedBy = actorId;
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
                CreatedBy: actorId,
              },
            });
          }

          if (allTrue && driverCount === 2) {
            await tx.busAssignment.update({
              where: { BusAssignmentID: busAssignment.BusAssignmentID },
              data: { Status: BusOperationStatus.NotStarted, UpdatedBy: actorId },
            });
          }
        }

        // Approved + NotStarted
        if (baStatus === BusOperationStatus.NotStarted) {
          if (command === 'toInOperation') {
            await tx.busAssignment.update({
              where: { BusAssignmentID: busAssignment.BusAssignmentID },
              data: { Status: BusOperationStatus.InOperation, UpdatedBy: actorId },
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
              data: { Status: RentalRequestStatus.Completed, UpdatedBy: actorId },
            });

            if (rentalRequestUpdates?.damageReport) {
              const { vehicleCondition, note, checkDate } = rentalRequestUpdates.damageReport;
              const DamageReportID = await generateFormattedID('DR');
              const damageData: any = {
                DamageReportID,
                BusAssignmentID: busAssignment.BusAssignmentID,
                Note: note || null,
                CheckDate: checkDate ? new Date(checkDate) : new Date(),
                CreatedBy: actorId,
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
            CreatedBy: actorId,
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

    await delCache(RENTAL_REQUESTS_CACHE_KEY);
    return result;
  }

  async patchRentalRequestIsDeleted(RentalRequestID: string, isDeleted: boolean, actor: string | null) {
    const updated = await prisma.rentalRequest.update({
      where: { RentalRequestID },
      data: { IsDeleted: isDeleted, UpdatedBy: actor },
      select: { RentalRequestID: true, IsDeleted: true, UpdatedBy: true, UpdatedAt: true },
    });
    await delCache(RENTAL_REQUESTS_CACHE_KEY);
    return updated;
  }
}
