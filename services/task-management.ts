import prisma from '@/client';
import { TaskType, TaskStatus, ToolSourceType } from '@prisma/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { fetchNewBuses } from '@/lib/fetchExternal';
import { delCache, CACHE_KEYS } from '@/lib/cache';

const TASK_CACHE_KEYS = [
  // Task status keys (all variants)
  CACHE_KEYS.TASK_ALL,
  CACHE_KEYS.TASK_PENDING,
  CACHE_KEYS.TASK_INPROGRESS,
  CACHE_KEYS.TASK_COMPLETED,
  CACHE_KEYS.TASK_CANCELLED,
  // Task priority-only keys
  CACHE_KEYS.TASK_LOW,
  CACHE_KEYS.TASK_MEDIUM,
  CACHE_KEYS.TASK_HIGH,
  CACHE_KEYS.TASK_CRITICAL,
  // Task status + priority keys
  CACHE_KEYS.TASK_PENDING_LOW,
  CACHE_KEYS.TASK_PENDING_MEDIUM,
  CACHE_KEYS.TASK_PENDING_HIGH,
  CACHE_KEYS.TASK_PENDING_CRITICAL,
  CACHE_KEYS.TASK_INPROGRESS_LOW,
  CACHE_KEYS.TASK_INPROGRESS_MEDIUM,
  CACHE_KEYS.TASK_INPROGRESS_HIGH,
  CACHE_KEYS.TASK_INPROGRESS_CRITICAL,
  CACHE_KEYS.TASK_COMPLETED_LOW,
  CACHE_KEYS.TASK_COMPLETED_MEDIUM,
  CACHE_KEYS.TASK_COMPLETED_HIGH,
  CACHE_KEYS.TASK_COMPLETED_CRITICAL,
  CACHE_KEYS.TASK_CANCELLED_LOW,
  CACHE_KEYS.TASK_CANCELLED_MEDIUM,
  CACHE_KEYS.TASK_CANCELLED_HIGH,
  CACHE_KEYS.TASK_CANCELLED_CRITICAL,
  // Related maintenance work caches
  CACHE_KEYS.MAINTENANCE_ALL,
  CACHE_KEYS.MAINTENANCE_PENDING,
  CACHE_KEYS.MAINTENANCE_INPROGRESS,
  CACHE_KEYS.MAINTENANCE_COMPLETED,
  CACHE_KEYS.MAINTENANCE_CANCELLED,
  // Maintenance priority-only keys
  CACHE_KEYS.MAINTENANCE_LOW ?? '',
  CACHE_KEYS.MAINTENANCE_MEDIUM ?? '',
  CACHE_KEYS.MAINTENANCE_HIGH ?? '',
  CACHE_KEYS.MAINTENANCE_CRITICAL ?? '',
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
].filter(Boolean) as string[];

interface TaskToolUpdate {
  TaskToolID?: string;
  ToolID?: string | null;
  QuantityUsed?: number | null;
  Unit?: string | null;
  SourceType?: string | null;
  CostPerUnit?: number | null;
  TotalCost?: number | null;
  Notes?: string | null;
}

export interface TaskUpdateBody {
  TaskID?: string;
  TaskName?: string;
  TaskType?: TaskType | null;
  TaskDescription?: string | null;
  AssignedTo?: string | null;
  Status?: TaskStatus;
  StartDate?: string | null;
  CompletedDate?: string | null;
  EstimatedHours?: number | null;
  ActualHours?: number | null;
  Notes?: string | null;
  ToolsUsed?: TaskToolUpdate[];
}

export class TaskManagementService {
  private parseToolSourceType(val?: string | null): ToolSourceType {
    if (!val) return ToolSourceType.FromInventory;
    const key = val as keyof typeof ToolSourceType;
    if (key in ToolSourceType) return ToolSourceType[key];
    return ToolSourceType.FromInventory;
  }

  private validateTask(task: TaskUpdateBody) {
    const requiredTaskFields: (keyof TaskUpdateBody)[] = [
      'TaskName',
      'TaskType',
      'AssignedTo',
      'Status',
    ];

    const missing = requiredTaskFields.filter(f => task[f] === undefined || task[f] === null);

    if (missing.length > 0) {
      throw new Error(`Task is missing required fields: ${missing.join(', ')}`);
    }

    if (task.ToolsUsed) {
      task.ToolsUsed.forEach((tool, index) => {
        // If TaskToolID exists, it's an update → skip required check
        if (!tool.TaskToolID) {
          if (tool.QuantityUsed == null || !tool.Unit || !tool.SourceType) {
            throw new Error(
              `TaskTool at index ${index} is missing required fields (QuantityUsed, Unit, SourceType)`
            );
          }
        }
      });
    }
  }

  private async buildBusMap(): Promise<Record<string, any>> {
    try {
      const buses = await fetchNewBuses();
      const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];

      // ✅ normalize bus fields
      const normalized = busesArr.map((b: any) => ({
        bus_id: b.bus_id ?? b.busId ?? b.id,
        plate_number: b.plate_number ?? b.license_plate ?? null,
        bus_type: b.bus_type ?? b.type ?? null,
        seat_capacity: b.seat_capacity ?? b.capacity ?? null,
      }));

      return Object.fromEntries(
        normalized.map((b: any) => [String(b.bus_id), b])
      );
    } catch {
      return {};
    }
  }

  private formatMaintenanceWorkWithTasks(work: any, busMap: Record<string, any>): any {
    const busID = work.DamageReport?.BusAssignment?.BusID;
    const bus = busMap[busID] || null;

    return {
      MaintenanceWorkID: work.MaintenanceWorkID,
      WorkTitle: work.WorkTitle,
      Priority: work.Priority,
      Status: work.Status,
      WorkNotes: work.WorkNotes,
      DamageReportedBy: work.DamageReport?.CreatedBy || null,
      BusPlateNumber: bus?.plate_number ?? bus?.license_plate ?? null,
      Tasks: work.Tasks.map((task: any) => ({
        TaskID: task.TaskID,
        TaskName: task.TaskName,
        TaskType: task.TaskType,
        TaskDescription: task.TaskDescription,
        AssignedTo: task.AssignedTo,
        Status: task.Status,
        EstimatedHours: task.EstimatedHours,
        ActualHours: task.ActualHours,
        StartDate: task.StartDate,
        CompletedDate: task.CompletedDate,
        Notes: task.Notes,
        ToolsUsed: task.ToolsUsed.map((tool: any) => ({
          TaskToolID: tool.TaskToolID,
          ToolID: tool.ToolID,
          QuantityUsed: tool.QuantityUsed,
          Unit: tool.Unit,
          SourceType: tool.SourceType,
          CostPerUnit: tool.CostPerUnit,
          TotalCost: tool.TotalCost,
          Notes: tool.Notes,
        })),
      })),
    };
  }

  async getMaintenanceWorksWithTasks(
    filterStatus?: string | null,
    filterPriority?: string | null,
    filterDamageID?: string | null
  ): Promise<any[]> {
    const whereClause: any = {};
    if (filterStatus) whereClause.Status = filterStatus;
    if (filterPriority) whereClause.Priority = filterPriority;
    if (filterDamageID) whereClause.DamageReportID = filterDamageID;

    const maintenanceWorks = await prisma.maintenanceWork.findMany({
      where: whereClause,
      include: {
        DamageReport: {
          include: {
            BusAssignment: true,
          },
        },
        Tasks: {
          include: {
            ToolsUsed: true,
          },
        },
      },
      orderBy: { CreatedAt: 'desc' },
    });

    const busMap = await this.buildBusMap();
    return maintenanceWorks.map(work => this.formatMaintenanceWorkWithTasks(work, busMap));
  }

  async updateTasksByMaintenanceWork(
    maintenanceWorkID: string,
    taskUpdates: TaskUpdateBody[],
    actor: string | null
  ): Promise<any[]> {
    const updatedTasks = await prisma.$transaction(async tx => {
      // Ensure maintenance work exists
      const mw = await tx.maintenanceWork.findUnique({
        where: { MaintenanceWorkID: maintenanceWorkID },
      });
      if (!mw) throw new Error('MaintenanceWork not found');

      // Fetch existing tasks including tools
      const existingTasks = await tx.task.findMany({
        where: { MaintenanceWorkID: maintenanceWorkID },
        include: { ToolsUsed: true },
      });

      const existingTaskMap = new Map(existingTasks.map(t => [t.TaskID, t]));
      const providedTaskIds = new Set<string>();
      const results: any[] = [];

      for (const task of taskUpdates) {
        // ✅ Validate task and tools
        this.validateTask(task);

        const taskId = task.TaskID ?? (await generateFormattedID('TSK'));
        providedTaskIds.add(taskId);

        const baseData: any = {
          TaskName: task.TaskName!,
          TaskType: task.TaskType!,
          TaskDescription: task.TaskDescription ?? '',
          AssignedTo: task.AssignedTo!,
          Status: task.Status!,
          StartDate: task.StartDate ? new Date(task.StartDate) : null,
          CompletedDate: task.CompletedDate ? new Date(task.CompletedDate) : null,
          EstimatedHours: task.EstimatedHours ?? 0,
          ActualHours: task.ActualHours ?? 0,
          Notes: task.Notes ?? null,
          UpdatedBy: actor ?? 'system',
        };

        let savedTask;

        if (existingTaskMap.has(taskId)) {
          // Update existing task
          savedTask = await tx.task.update({
            where: { TaskID: taskId },
            data: baseData,
          });
        } else {
          // Create new task
          savedTask = await tx.task.create({
            data: {
              ...baseData,
              TaskID: taskId,
              MaintenanceWork: { connect: { MaintenanceWorkID: maintenanceWorkID } },
              CreatedBy: actor ?? 'system',
            },
          });
        }

        // Handle task tools
        const tools = task.ToolsUsed ?? [];
        const providedToolIds = new Set<string>();

        for (const t of tools) {
          let toolId = t.TaskToolID;

          if (
            toolId &&
            (await tx.taskTool.findUnique({ where: { TaskToolID: toolId } }))
          ) {
            // Update existing tool
            await tx.taskTool.update({
              where: { TaskToolID: toolId },
              data: {
                ToolID: t.ToolID ?? undefined,
                QuantityUsed: t.QuantityUsed ?? undefined,
                Unit: t.Unit ?? undefined,
                SourceType: this.parseToolSourceType(t.SourceType),
                CostPerUnit: t.CostPerUnit ?? undefined,
                TotalCost: t.TotalCost ?? undefined,
                Notes: t.Notes ?? undefined,
                UpdatedBy: actor ?? 'system',
              },
            });
          } else {
            // Create new tool
            toolId = await generateFormattedID('TSKT');
            await tx.taskTool.create({
              data: {
                TaskToolID: toolId,
                TaskID: taskId,
                ToolID: t.ToolID ?? null,
                QuantityUsed: t.QuantityUsed!,
                Unit: t.Unit!,
                SourceType: this.parseToolSourceType(t.SourceType),
                CostPerUnit: t.CostPerUnit ?? 0,
                TotalCost: t.TotalCost ?? 0,
                Notes: t.Notes ?? null,
                CreatedBy: actor ?? 'system',
                UpdatedBy: actor ?? 'system',
              },
            });
          }

          providedToolIds.add(toolId);
        }

        // Delete removed tools
        await tx.taskTool.deleteMany({
          where: {
            TaskID: taskId,
            TaskToolID: { notIn: Array.from(providedToolIds) },
          },
        });

        results.push(savedTask);
      }

      // Delete tasks not in payload
      const toDelete = existingTasks
        .map(t => t.TaskID)
        .filter(id => !providedTaskIds.has(id));

      if (toDelete.length > 0) {
        await tx.taskTool.deleteMany({ where: { TaskID: { in: toDelete } } });
        await tx.task.deleteMany({ where: { TaskID: { in: toDelete } } });
      }

      return results;
    });

    // Clear all task and maintenance work caches
    await this.clearCache();
    return updatedTasks;
  }

  private async clearCache(): Promise<void> {
    await Promise.all(TASK_CACHE_KEYS.map(key => delCache(key)));
  }
}