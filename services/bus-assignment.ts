import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { delCache, CACHE_KEYS } from '@/lib/cache';

export class BusAssignmentService {
  private readonly CACHE_KEYS_TO_CLEAR = [
    CACHE_KEYS.BUS_ASSIGNMENTS ?? '',
    CACHE_KEYS.DASHBOARD ?? '',
    CACHE_KEYS.BUS_OPERATIONS_NOTREADY ?? '',
    CACHE_KEYS.BUS_OPERATIONS_NOTSTARTED ?? '',
    CACHE_KEYS.BUS_OPERATIONS_INOPERATION ?? '',
    CACHE_KEYS.BUS_OPERATIONS_ALL ?? '',
  ];

  async validateQuotaPolicyDates(quotaPolicies: any[]): Promise<void> {
    if (!Array.isArray(quotaPolicies)) return;

    const sorted = quotaPolicies
      .map((qp: any) => {
        const start = qp.startDate || qp.StartDate;
        const end = qp.endDate || qp.EndDate;
        if (!start || !end) {
          throw new Error('All QuotaPolicy entries must have both startDate and endDate.');
        }
        return {
          start: new Date(start),
          end: new Date(end),
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].end > sorted[i + 1].start) {
        throw new Error('QuotaPolicy date ranges cannot overlap.');
      }
    }
  }

  async validateBusAvailability(busId: string, excludeId?: string): Promise<void> {
    const existingBus = await prisma.busAssignment.findFirst({
      where: {
        BusID: busId,
        IsDeleted: false,
        ...(excludeId && { NOT: { BusAssignmentID: excludeId } }),
      },
    });
    if (existingBus) {
      throw new Error('Bus is already assigned.');
    }
  }

  async validateDriverAvailability(driverId: string, excludeId?: string): Promise<void> {
    const existingDriver = await prisma.regularBusAssignment.findFirst({
      where: {
        DriverID: driverId,
        BusAssignment: { IsDeleted: false },
        ...(excludeId && { NOT: { RegularBusAssignmentID: excludeId } }),
      },
    });
    if (existingDriver) {
      throw new Error('Driver is already assigned.');
    }
  }

  async validateConductorAvailability(conductorId: string, excludeId?: string): Promise<void> {
    const existingConductor = await prisma.regularBusAssignment.findFirst({
      where: {
        ConductorID: conductorId,
        BusAssignment: { IsDeleted: false },
        ...(excludeId && { NOT: { RegularBusAssignmentID: excludeId } }),
      },
    });
    if (existingConductor) {
      throw new Error('Conductor is already assigned.');
    }
  }

  private async clearAllRelatedCaches(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_CLEAR.filter(key => key).map(key => delCache(key)));
  }

  async createBusAssignment(data: any, actor: string | null): Promise<any> {
    // Validate inputs
    await this.validateQuotaPolicyDates(data.QuotaPolicy);
    await this.validateBusAvailability(data.BusID);
    await this.validateDriverAvailability(data.DriverID);
    await this.validateConductorAvailability(data.ConductorID);

    const busAssignmentID = generateFormattedID('BA');

    await prisma.$transaction(
      async (tx) => {
        // Create BusAssignment with RegularBusAssignment
        await tx.busAssignment.create({
          data: {
            BusAssignmentID: busAssignmentID,
            BusID: data.BusID,
            RouteID: data.RouteID,
            Status: 'NotReady',
            CreatedBy: actor,
            RegularBusAssignment: {
              create: {
                DriverID: data.DriverID,
                ConductorID: data.ConductorID,
                CreatedBy: actor,
              },
            },
          },
        });

        // Create quota policies
        if (Array.isArray(data.QuotaPolicy)) {
          for (const qp of data.QuotaPolicy) {
            await this.createQuotaPolicy(tx, busAssignmentID, qp, actor);
          }
        }
      },
      { timeout: 10_000 }
    );

    await this.clearAllRelatedCaches();

    // Fetch and return created assignment
    return this.getBusAssignmentById(busAssignmentID);
  }

  async updateBusAssignment(id: string, data: any, actor: string | null): Promise<any> {
    // Validate quota policies
    await this.validateQuotaPolicyDates(data.quotaPolicies);

    const existing = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID: id },
      select: {
        BusID: true,
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
            DriverID: true,
            ConductorID: true,
          },
        },
      },
    });

    if (!existing?.RegularBusAssignment) {
      throw new Error('BusAssignment or RegularBusAssignment not found');
    }

    // Validate new assignments (exclude current)
    if (data.BusID !== existing.BusID) {
      await this.validateBusAvailability(data.BusID, id);
    }

    if (data.DriverID !== existing.RegularBusAssignment.DriverID) {
      await this.validateDriverAvailability(data.DriverID, existing.RegularBusAssignment.RegularBusAssignmentID);
    }

    if (data.ConductorID !== existing.RegularBusAssignment.ConductorID) {
      await this.validateConductorAvailability(data.ConductorID, existing.RegularBusAssignment.RegularBusAssignmentID);
    }

    // Update assignment
    await prisma.busAssignment.update({
      where: { BusAssignmentID: id },
      data: {
        BusID: data.BusID,
        RouteID: data.RouteID,
        UpdatedBy: actor,
        RegularBusAssignment: {
          update: {
            DriverID: data.DriverID,
            ConductorID: data.ConductorID,
            UpdatedBy: actor,
          },
        },
      },
    });

    // Delete and recreate quota policies
    const newRegularBusAssignmentID = existing.RegularBusAssignment.RegularBusAssignmentID;
    await prisma.quota_Policy.deleteMany({
      where: { RegularBusAssignmentID: newRegularBusAssignmentID },
    });

    if (Array.isArray(data.quotaPolicies)) {
      for (const qp of data.quotaPolicies) {
        const quotaPolicyID = generateFormattedID('QP');
        const startDate = qp.startDate || qp.StartDate;
        const endDateRaw = qp.endDate || qp.EndDate;
        const endDateObj = endDateRaw ? new Date(endDateRaw) : undefined;
        if (endDateObj) {
          endDateObj.setHours(23, 59, 59, 999);
        }

        const quotaPolicyData: any = {
          QuotaPolicyID: quotaPolicyID,
          RegularBusAssignmentID: newRegularBusAssignmentID,
          ...(startDate && { StartDate: new Date(startDate) }),
          ...(endDateObj && { EndDate: endDateObj }),
          CreatedBy: actor,
          UpdatedBy: actor,
        };

        if (qp.type && qp.type.toUpperCase() === 'FIXED') {
          quotaPolicyData.Fixed = {
            create: {
              Quota: qp.value,
              CreatedBy: actor,
              UpdatedBy: actor,
            },
          };
        } else if (qp.type && qp.type.toUpperCase() === 'PERCENTAGE') {
          quotaPolicyData.Percentage = {
            create: {
              Percentage: qp.value,
              CreatedBy: actor,
              UpdatedBy: actor,
            },
          };
        }

        await prisma.quota_Policy.create({
          data: quotaPolicyData,
        });
      }
    }

    await this.clearAllRelatedCaches();
    return this.getBusAssignmentById(id);
  }

  async softDeleteBusAssignment(id: string, actor: string | null): Promise<any> {
    await prisma.busAssignment.update({
      where: { BusAssignmentID: id },
      data: { IsDeleted: true, UpdatedBy: actor },
    });

    await this.clearAllRelatedCaches();
    return { IsDeleted: true, UpdatedBy: actor };
  }

  private async createQuotaPolicy(tx: any, busAssignmentId: string, qp: any, actor: string | null): Promise<void> {
    const quotaPolicyID = generateFormattedID('QP');
    const startDate = qp.startDate ? new Date(qp.startDate) : undefined;
    const endDate = qp.endDate ? new Date(qp.endDate) : undefined;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    const quotaPolicyData: any = {
      QuotaPolicyID: quotaPolicyID,
      RegularBusAssignmentID: busAssignmentId,
      ...(startDate && { StartDate: startDate }),
      ...(endDate && { EndDate: endDate }),
      CreatedBy: actor,
    };

    if (qp.type && qp.type.toUpperCase() === 'FIXED') {
      quotaPolicyData.Fixed = {
        create: {
          Quota: qp.value,
          CreatedBy: actor,
        },
      };
    } else if (qp.type && qp.type.toUpperCase() === 'PERCENTAGE') {
      quotaPolicyData.Percentage = {
        create: {
          Percentage: qp.value,
          CreatedBy: actor,
        },
      };
    }

    await tx.quota_Policy.create({
      data: quotaPolicyData,
    });
  }

  private async getBusAssignmentById(id: string): Promise<any> {
    return prisma.busAssignment.findUnique({
      where: { BusAssignmentID: id },
      select: {
        BusAssignmentID: true,
        BusID: true,
        RouteID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
            DriverID: true,
            ConductorID: true,
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
                StartDate: true,
                EndDate: true,
                CreatedAt: true,
                UpdatedAt: true,
                CreatedBy: true,
                UpdatedBy: true,
                Fixed: { select: { Quota: true, CreatedAt: true, UpdatedAt: true, CreatedBy: true, UpdatedBy: true } },
                Percentage: { select: { Percentage: true, CreatedAt: true, UpdatedAt: true, CreatedBy: true, UpdatedBy: true } },
              },
            },
          },
        },
      },
    });
  }
}