import prisma from '@/client';
import { RentalRequestStatus, BusOperationStatus, DamageReportStatus, AssignmentType } from '@prisma/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { fetchBuses, fetchNewBuses } from '@/lib/fetchExternal';
import { delCache, CACHE_KEYS } from '@/lib/cache';
import cloudinary from '@/lib/cloudinary';
import { validateRequestLocations } from '@/services/bus-location-validation';

const RENTAL_REQUESTS_CACHE_KEYS = [
  CACHE_KEYS.RENTAL_REQUESTS_ALL,
  CACHE_KEYS.RENTAL_REQUESTS_PENDING,
  CACHE_KEYS.RENTAL_REQUESTS_APPROVED,
  CACHE_KEYS.RENTAL_REQUESTS_REJECTED,
  CACHE_KEYS.RENTAL_REQUESTS_COMPLETED,
  CACHE_KEYS.DASHBOARD ?? '',
  CACHE_KEYS.DAMAGE_REPORT_ALL ?? '',
  CACHE_KEYS.DAMAGE_REPORT_PENDING ?? '',
  CACHE_KEYS.DAMAGE_REPORT_ACCEPTED ?? '',
  CACHE_KEYS.DAMAGE_REPORT_REJECTED ?? '',
  CACHE_KEYS.DAMAGE_REPORT_NA ?? '',
].filter(Boolean) as string[];

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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

    const rentalBusAssignmentSelect: any = normalized === 'Approved' || normalized === 'Completed'
      ? {
          select: {
            RentalBusAssignmentID: true,
            BusAssignment: {
              select: {
                BusAssignmentID: true,
                BusID: true,
                AssignmentType: true,
                Status: true,
                Battery: true,
                Lights: true,
                Oil: true,
                Water: true,
                Brake: true,
                Air: true,
                Gas: true,
                Engine: true,
                TireCondition: true,
                Self_Driver: true,
                Self_Conductor: true,
                IsDeleted: true,
                DamageReports: {
                  orderBy: { CheckDate: 'desc' as const },
                  take: 1,
                },
              },
            },
            RentalDrivers: {
              select: { RentalDriverID: true, DriverID: true, CreatedAt: true },
            },
          },
        }
      : {
          select: {
            RentalBusAssignmentID: true,
            BusAssignment: {
              select: {
                BusAssignmentID: true,
                BusID: true,
                AssignmentType: true,
                Status: true,
              },
            },
          },
        };

    const rentalRequests = await prisma.rentalRequest.findMany({
      where,
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        RentalRequestID: true,
        RentalBusAssignmentID: true,
        RouteName: true,
        Pickuplatitude: true,
        Pickuplongitude: true,
        Dropofflatitude: true,
        Dropofflongitude: true,
        DistanceKM: true,
        NumberOfPassengers: true,
        RentalDate: true,
        Duration: true,
        SpecialRequirements: true,
        Status: true,
        CustomerName: true,
        CustomerContact: true,
        CustomerEmail: true,
        IDType: true,
        IDNumber: true,
        HomeAddress: true,
        IDImage: true,
        TotalRentalAmount: true,
        DownPaymentAmount: true,
        BalanceAmount: true,
        DownPaymentDate: true,
        FullPaymentDate: true,
        CancelledAtDate: true,
        CancelledReason: true,
        AutoRejectReason: true,
        IsDeleted: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        RentalBusAssignment: rentalBusAssignmentSelect,
      },
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
        IDImageUrl: getIDImageUrl(rr.IDImage),
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
    // Extract fields - handle both regular object and FormData
    let data: any;
    
    // Check if body has FormData methods
    if (typeof body.get === 'function') {
      // It's FormData - convert to object
      data = {};
      const formDataKeys = [
        'CustomerName', 'CustomerContact', 'CustomerEmail', 'CustomerAddress',
        'IDType', 'IDNumber', 'IDImage', 'PickupLocation', 'DropoffLocation',
        'RouteName', 'NumberOfPassengers', 'RentalDate', 'Duration', 'DistanceKM',
        'TotalRentalAmount', 'BusID', 'SpecialRequirements',
        'Pickuplatitude', 'Pickuplongitude', 'Dropofflatitude', 'Dropofflongitude',
        'DownPaymentAmount', 'DownPaymentDate', 'FullPaymentDate', 'Status'
      ];
      
      for (const key of formDataKeys) {
        const value = body.get(key);
        if (value !== null) {
          data[key] = value;
        }
      }
    } else {
      // It's a regular object
      data = body;
    }

    const {
      Pickuplatitude, Pickuplongitude, Dropofflatitude, Dropofflongitude,
      DistanceKM, TotalRentalAmount, NumberOfPassengers, RentalDate, Duration,
      CustomerName, CustomerContact, BusID, RouteName, Status, SpecialRequirements,
      IDType, IDNumber, HomeAddress, CustomerAddress, IDImage, CustomerEmail,
      PickupLocation, DropoffLocation
    } = data;

    // Validation
    if (
      !Pickuplatitude || !Pickuplongitude ||
      !Dropofflatitude || !Dropofflongitude ||
      DistanceKM == null || TotalRentalAmount == null ||
      NumberOfPassengers == null || !RentalDate || Duration == null ||
      !CustomerName || !CustomerContact || !CustomerEmail || !BusID ||
      !RouteName || !PickupLocation || !DropoffLocation ||
      !IDType || !IDNumber || !(HomeAddress || CustomerAddress) ||
      !(IDImage instanceof File)
    ) {
      throw new Error('Missing or invalid required fields');
    }

    const parsedRentalDate = new Date(RentalDate);
    if (isNaN(parsedRentalDate.getTime())) throw new Error('Invalid RentalDate');

    if (!isValidEmail(CustomerEmail)) throw new Error('Invalid CustomerEmail format');

    // Validate location vicinity
    const locationValidation = await validateRequestLocations(
      Number(Pickuplatitude),
      Number(Pickuplongitude),
      Number(Dropofflatitude),
      Number(Dropofflongitude)
    );

    // Determine final status based on location validation
    let finalStatus: RentalRequestStatus;
    let autoRejectReason: string | null = null;

    if (!locationValidation.isValid) {
      finalStatus = RentalRequestStatus.Rejected;
      autoRejectReason = `Auto-Rejected (Outside Vicinity): ${locationValidation.reasons.join('; ')}`;
    } else {
      finalStatus = this.normalizeStatusInput(Status) ?? RentalRequestStatus.Pending;
    }

    const baID = await generateFormattedID('BA');
    const rrID = await generateFormattedID('RR');

    const downPaymentAmt = Number(data.DownPaymentAmount ?? null);
    const downPaymentDate = data.DownPaymentDate ? new Date(data.DownPaymentDate) : null;
    const fullPaymentDate = data.FullPaymentDate ? new Date(data.FullPaymentDate) : null;
    const balanceAmt = !isNaN(downPaymentAmt) && TotalRentalAmount != null
      ? Number(TotalRentalAmount) - downPaymentAmt
      : null;

    // Upload the ID image to Cloudinary and get public_id
    const idImagePublicId = await uploadIDImageToCloudinary(IDImage);

    const created = await prisma.$transaction(async tx => {
      // create BusAssignment with enum AssignmentType.Rental
      await tx.busAssignment.create({
        data: { 
          BusAssignmentID: baID, 
          BusID: String(BusID), 
          AssignmentType: AssignmentType.Rental, 
          IsDeleted: false, 
          CreatedBy: actor 
        },
      });

      await tx.rentalBusAssignment.create({
        data: { RentalBusAssignmentID: baID, CreatedBy: actor },
      });

      const rr = await tx.rentalRequest.create({
        data: {
          RentalRequestID: rrID,
          RentalBusAssignmentID: baID,
          RouteName: String(RouteName),
          Pickuplatitude: String(Pickuplatitude),
          Pickuplongitude: String(Pickuplongitude),
          Dropofflatitude: String(Dropofflatitude),
          Dropofflongitude: String(Dropofflongitude),
          DistanceKM: Number(DistanceKM),
          TotalRentalAmount: Number(TotalRentalAmount),
          NumberOfPassengers: Number(NumberOfPassengers),
          RentalDate: parsedRentalDate,
          Duration: Number(Duration),
          SpecialRequirements: SpecialRequirements ?? null,
          Status: finalStatus,
          IDType: String(IDType),
          IDNumber: String(IDNumber),
          HomeAddress: String(HomeAddress || CustomerAddress),
          IDImage: idImagePublicId,
          CustomerName: String(CustomerName),
          CustomerContact: String(CustomerContact),
          CustomerEmail: String(CustomerEmail),
          DownPaymentAmount: !isNaN(downPaymentAmt) ? downPaymentAmt : null,
          BalanceAmount: !isNaN(balanceAmt as number) ? balanceAmt : null,
          DownPaymentDate: downPaymentDate ?? null,
          FullPaymentDate: fullPaymentDate ?? null,
          CancelledAtDate: null,
          CancelledReason: null,
          AutoRejectReason: autoRejectReason,
          IsDeleted: false,
          CreatedBy: actor,
        },
        include: {
          RentalBusAssignment: {
            include: { 
              BusAssignment: { 
                select: { 
                  BusAssignmentID: true, 
                  BusID: true, 
                  AssignmentType: true, 
                  Status: true 
                } 
              } 
            },
          },
        },
      });

      return rr;
    });

    // invalidate cache
    await Promise.all(RENTAL_REQUESTS_CACHE_KEYS.map(k => delCache(k)));
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
      rentalAssignmentUpdates,
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
            data: { ...rentalRequestUpdates, Status: RentalRequestStatus.Approved, UpdatedBy: actorId },
          });

          await tx.busAssignment.update({
            where: { BusAssignmentID: busAssignment.BusAssignmentID },
            data: { Status: BusOperationStatus.NotReady, UpdatedBy: actorId },
          });
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

    await Promise.all(RENTAL_REQUESTS_CACHE_KEYS.map(k => delCache(k)));
    return result;
  }

  async patchRentalRequestIsDeleted(RentalRequestID: string, isDeleted: boolean, actor: string | null) {
    const updated = await prisma.rentalRequest.update({
      where: { RentalRequestID },
      data: { IsDeleted: isDeleted, UpdatedBy: actor },
      select: { RentalRequestID: true, IsDeleted: true, UpdatedBy: true, UpdatedAt: true },
    });
    await Promise.all(RENTAL_REQUESTS_CACHE_KEYS.map(k => delCache(k)));
    return updated;
  }
}

export async function uploadIDImageToCloudinary(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'rental-ids',
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          return reject(error);
        }
        resolve(result.public_id);
      }
    ).end(buffer);
  });
}

function getIDImageUrl(publicId?: string | null) {
  if (!publicId) return null;

  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 800, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' },
    ],
  });
}