import prisma from '@/client';
import { DamageReportStatus } from '@prisma/client';
import { fetchNewBuses } from '@/lib/fetchExternal';
import { generateFormattedID } from '@/lib/idGenerator';
import { delCache, CACHE_KEYS } from '@/lib/cache';

// const CACHE_KEYS_TO_CLEAR = [CACHE_KEYS.DAMAGE_REPORTS ?? ''];

export class DamageReportService {
  private readonly CACHE_KEYS_TO_CLEAR = [
    CACHE_KEYS.DAMAGE_REPORT_ALL ?? '',
    CACHE_KEYS.DAMAGE_REPORT_PENDING ?? '',
    CACHE_KEYS.DAMAGE_REPORT_ACCEPTED ?? '',
    CACHE_KEYS.DAMAGE_REPORT_REJECTED ?? '',
    CACHE_KEYS.DAMAGE_REPORT_NA ?? '',

    // Status-only keys
    CACHE_KEYS.MAINTENANCE_ALL ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED ?? '',
    // Priority-only keys
    CACHE_KEYS.MAINTENANCE_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_CRITICAL ?? '',
    // Status + Priority keys
    CACHE_KEYS.MAINTENANCE_PENDING_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING_CRITICAL ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS_CRITICAL ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED_CRITICAL ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED_CRITICAL ?? '',
  ];
  private async buildBusMap(): Promise<Record<string, any>> {
    try {
      const buses = await fetchNewBuses();
      const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];
      return Object.fromEntries(busesArr.map((b: any) => [b.bus_id ?? b.busId, b]));
    } catch {
      return {};
    }
  }

  private formatDamageReport(report: any, busMap: Record<string, any>): any {
    const bus = busMap[report.BusAssignment?.BusID ?? ''];

    return {
      DamageReportID: report.DamageReportID,
      BusAssignmentID: report.BusAssignment?.BusAssignmentID ?? null,
      BusID: report.BusAssignment?.BusID ?? null,
      BusPlateNumber: bus?.plate_number ?? bus?.license_plate ?? null,
      RouteName: report.BusAssignment?.Route?.RouteName ?? null,
      Status: report.Status,
      Note: report.Note,
      CheckDate: report.CheckDate,
      CreatedAt: report.CreatedAt,
      UpdatedAt: report.UpdatedAt,
      CreatedBy: report.CreatedBy,
      UpdatedBy: report.UpdatedBy,
      Battery: report.Battery,
      Lights: report.Lights,
      Oil: report.Oil,
      Water: report.Water,
      Brake: report.Brake,
      Air: report.Air,
      Gas: report.Gas,
      Engine: report.Engine,
      TireCondition: report.TireCondition,
    };
  }

  async getDamageReports(filterStatus: string | null): Promise<any[]> {
    const whereClause: any = {};
    if (filterStatus) {
      const validStatuses = Object.values(DamageReportStatus);
      if (!validStatuses.includes(filterStatus as DamageReportStatus)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      whereClause.Status = filterStatus;
    }

    const damageReports = await prisma.damageReport.findMany({
      where: whereClause,
      include: {
        BusAssignment: {
          select: {
            BusAssignmentID: true,
            BusID: true,
            Route: { select: { RouteName: true } },
          },
        },
      },
      orderBy: { CheckDate: 'desc' },
    });

    const busMap = await this.buildBusMap();
    return damageReports.map(report => this.formatDamageReport(report, busMap));
  }

  async updateDamageReportStatus(damageReportID: string, newStatus: string, actor: string | null): Promise<any> {
    // Validate status
    const validStatuses = Object.values(DamageReportStatus);
    if (!validStatuses.includes(newStatus as DamageReportStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Verify damage report exists
    const existingReport = await prisma.damageReport.findUnique({
      where: { DamageReportID: damageReportID },
    });

    if (!existingReport) {
      throw new Error('Damage report not found');
    }

    // Update the damage report
    const updatedReport = await prisma.damageReport.update({
      where: { DamageReportID: damageReportID },
      data: {
        Status: newStatus as DamageReportStatus,
        UpdatedBy: actor,
      },
      select: {
        DamageReportID: true,
        Status: true,
        UpdatedBy: true,
        UpdatedAt: true,
      },
    });

    // Create MaintenanceWork if status is Accepted
    if (newStatus === DamageReportStatus.Accepted) {
      const existingWork = await prisma.maintenanceWork.findUnique({
        where: { DamageReportID: damageReportID },
      });

      if (!existingWork) {
        const maintenanceWorkID = await generateFormattedID('MW');
        await prisma.maintenanceWork.create({
          data: {
            MaintenanceWorkID: maintenanceWorkID,
            DamageReportID: damageReportID,
            CreatedBy: actor,
            UpdatedBy: actor,
          },
        });
      }
    }

    await this.clearCache();

    return updatedReport;
  }

  private async clearCache(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_CLEAR.filter(key => key).map(key => delCache(key)));
  }
}