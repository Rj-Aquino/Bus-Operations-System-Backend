import prisma from '@/client';
import { MaintenanceStatus, MaintenancePriority } from '@prisma/client';
import { fetchNewBuses } from '@/lib/fetchExternal';
// import { delCache, CACHE_KEYS } from '@/lib/cache';

// const CACHE_KEYS_TO_CLEAR = [CACHE_KEYS.MAINTENANCE_WORK ?? ''];

export class MaintenanceWorkService {
  private async buildBusMap(): Promise<Record<string, any>> {
    try {
      const buses = await fetchNewBuses();
      const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];
      return Object.fromEntries(busesArr.map((b: any) => [b.bus_id ?? b.busId, b]));
    } catch {
      return {};
    }
  }

  private formatMaintenanceWork(work: any, busMap: Record<string, any>): any {
    const bus = busMap[work.DamageReport?.BusAssignment?.BusID ?? ''];

    return {
      MaintenanceWorkID: work.MaintenanceWorkID,
      DamageReportID: work.DamageReportID,

      // 🔧 Maintenance Details
      Status: work.Status,
      Priority: work.Priority,
      WorkTitle: work.WorkTitle,
      ScheduledDate: work.ScheduledDate,
      DueDate: work.DueDate,
      CompletedDate: work.CompletedDate,
      EstimatedCost: work.EstimatedCost,
      ActualCost: work.ActualCost,
      WorkNotes: work.WorkNotes,

      // 🧾 Damage Report Details
      DamageNote: work.DamageReport?.Note ?? null,
      CheckDate: work.DamageReport?.CheckDate ?? null,
      DamageStatus: work.DamageReport?.Status ?? null,

      // 🧩 Vehicle Condition Checks
      Battery: work.DamageReport?.Battery ?? false,
      Lights: work.DamageReport?.Lights ?? false,
      Oil: work.DamageReport?.Oil ?? false,
      Water: work.DamageReport?.Water ?? false,
      Brake: work.DamageReport?.Brake ?? false,
      Air: work.DamageReport?.Air ?? false,
      Gas: work.DamageReport?.Gas ?? false,
      Engine: work.DamageReport?.Engine ?? false,
      TireCondition: work.DamageReport?.TireCondition ?? false,

      // 🚍 Bus Details
      BusPlateNumber: bus?.plate_number ?? bus?.license_plate ?? null,

      // 🕒 Metadata
      CreatedAt: work.CreatedAt,
      UpdatedAt: work.UpdatedAt,
      CreatedBy: work.CreatedBy,
      UpdatedBy: work.UpdatedBy,
    };
  }

  async getMaintenanceWorks(filterStatus: string | null, filterPriority: string | null): Promise<any[]> {
    const whereClause: any = {};

    if (filterStatus) {
      const validStatuses = Object.values(MaintenanceStatus);
      if (!validStatuses.includes(filterStatus as MaintenanceStatus)) {
        throw new Error(`Invalid Status. Must be one of: ${validStatuses.join(', ')}`);
      }
      whereClause.Status = filterStatus;
    }

    if (filterPriority) {
      const validPriorities = Object.values(MaintenancePriority);
      if (!validPriorities.includes(filterPriority as MaintenancePriority)) {
        throw new Error(`Invalid Priority. Must be one of: ${validPriorities.join(', ')}`);
      }
      whereClause.Priority = filterPriority;
    }

    const maintenanceWorks = await prisma.maintenanceWork.findMany({
      where: whereClause,
      include: {
        DamageReport: {
          include: {
            BusAssignment: {
              select: {
                BusAssignmentID: true,
                BusID: true,
              },
            },
          },
        },
      },
      orderBy: { CreatedAt: 'desc' },
    });

    const busMap = await this.buildBusMap();
    return maintenanceWorks.map(work => this.formatMaintenanceWork(work, busMap));
  }

  async updateMaintenanceWork(
    maintenanceWorkID: string,
    body: any,
    actor: string | null
  ): Promise<any> {
    const {
      Status,
      Priority,
      WorkTitle,
      ScheduledDate,
      DueDate,
      CompletedDate,
      EstimatedCost,
      ActualCost,
      WorkNotes,
    } = body ?? {};

    // Validate enums (Status, Priority)
    const validStatuses = Object.values(MaintenanceStatus);
    const validPriorities = Object.values(MaintenancePriority);

    if (Status && !validStatuses.includes(Status as MaintenanceStatus)) {
      throw new Error(`Invalid Status. Must be one of: ${validStatuses.join(', ')}`);
    }

    if (Priority && !validPriorities.includes(Priority as MaintenancePriority)) {
      throw new Error(`Invalid Priority. Must be one of: ${validPriorities.join(', ')}`);
    }

    // Ensure the record exists
    const existing = await prisma.maintenanceWork.findUnique({
      where: { MaintenanceWorkID: maintenanceWorkID },
    });

    if (!existing) {
      throw new Error('MaintenanceWork not found');
    }

    // Validation: Prevent CompletedDate update if not Completed
    const finalStatus = Status ?? existing.Status;

    if (CompletedDate && finalStatus !== MaintenanceStatus.Completed) {
      throw new Error('Cannot update CompletedDate unless Status is set to "Completed".');
    }

    // Update MaintenanceWork
    const updatedWork = await prisma.maintenanceWork.update({
      where: { MaintenanceWorkID: maintenanceWorkID },
      data: {
        Status: Status as MaintenanceStatus | undefined,
        Priority: Priority as MaintenancePriority | undefined,
        WorkTitle,
        ScheduledDate: ScheduledDate ? new Date(ScheduledDate) : undefined,
        DueDate: DueDate ? new Date(DueDate) : undefined,
        CompletedDate: CompletedDate ? new Date(CompletedDate) : undefined,
        EstimatedCost: typeof EstimatedCost === 'number' ? EstimatedCost : undefined,
        ActualCost: typeof ActualCost === 'number' ? ActualCost : undefined,
        WorkNotes,
        UpdatedBy: actor,
      },
      select: {
        MaintenanceWorkID: true,
        DamageReportID: true,
        Status: true,
        Priority: true,
        WorkTitle: true,
        ScheduledDate: true,
        DueDate: true,
        CompletedDate: true,
        EstimatedCost: true,
        ActualCost: true,
        WorkNotes: true,
        UpdatedBy: true,
        UpdatedAt: true,
      },
    });

    // await this.clearCache();

    return updatedWork;
  }

//   private async clearCache(): Promise<void> {
//     await Promise.all(CACHE_KEYS_TO_CLEAR.map(key => delCache(key)));
//   }
}