import { NextRequest, NextResponse } from "next/server";
import prisma from "@/client";
import { withCors } from "@/lib/withcors";
import { authenticateRequest } from "@/lib/auth";
import { TaskType, TaskStatus, ToolSourceType } from "@prisma/client";
import { generateFormattedID } from "@/lib/idGenerator";

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

interface TaskUpdateBody {
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

// Parse ToolSourceType safely
const parseToolSourceType = (val?: string | null): ToolSourceType => {
  if (!val) return ToolSourceType.FromInventory;
  const key = val as keyof typeof ToolSourceType;
  if (key in ToolSourceType) return ToolSourceType[key];
  return ToolSourceType.FromInventory;
};

// Validate task and its tools
const validateTask = (task: TaskUpdateBody) => {
  const requiredTaskFields: (keyof TaskUpdateBody)[] = [
    "TaskName",
    "TaskType",
    "AssignedTo",
    "Status"
  ];

  const missing = requiredTaskFields.filter(f => task[f] === undefined || task[f] === null);

  if (missing.length > 0) {
    throw new Error(`Task is missing required fields: ${missing.join(", ")}`);
  }

  if (task.ToolsUsed) {
    task.ToolsUsed.forEach((tool, index) => {
      // If TaskToolID exists, it's an update → skip required check
      if (!tool.TaskToolID) {
        if (tool.QuantityUsed == null || !tool.Unit || !tool.SourceType) {
          throw new Error(`TaskTool at index ${index} is missing required fields (QuantityUsed, Unit, SourceType)`);
        }
      }
    });
  }
};

const updateTasksByMaintenanceWork = async (request: NextRequest) => {
  const { user, error } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  // Extract MaintenanceWorkID from URL
  const pathname = request.nextUrl.pathname;
  const pathSegments = pathname.split("/").filter(Boolean);
  const maintenanceWorkId = pathSegments[pathSegments.length - 1];

  if (!maintenanceWorkId)
    return NextResponse.json({ error: "MaintenanceWorkID is required in URL" }, { status: 400 });

  try {
    const body = (await request.json()) as { Tasks?: TaskUpdateBody[] };
    if (!body || !Array.isArray(body.Tasks))
      return NextResponse.json({ error: "Request body must include Tasks array" }, { status: 400 });

    const updatedTasks = await prisma.$transaction(async (tx) => {
      // Ensure maintenance work exists
      const mw = await tx.maintenanceWork.findUnique({
        where: { MaintenanceWorkID: maintenanceWorkId },
      });
      if (!mw) throw new Error("MaintenanceWork not found");

      // Fetch existing tasks including tools
      const existingTasks = await tx.task.findMany({
        where: { MaintenanceWorkID: maintenanceWorkId },
        include: { ToolsUsed: true },
      });

      const existingTaskMap = new Map(existingTasks.map((t) => [t.TaskID, t]));
      const providedTaskIds = new Set<string>();
      const results: any[] = [];

      for (const task of body.Tasks!) {
        // ✅ Validate task and tools
        validateTask(task);

        const taskId = task.TaskID ?? (await generateFormattedID("TSK"));
        providedTaskIds.add(taskId);

        const baseData: any = {
          TaskName: task.TaskName!,
          TaskType: task.TaskType!,
          TaskDescription: task.TaskDescription ?? "",
          AssignedTo: task.AssignedTo!,
          Status: task.Status!,
          StartDate: task.StartDate ? new Date(task.StartDate) : null,
          CompletedDate: task.CompletedDate ? new Date(task.CompletedDate) : null,
          EstimatedHours: task.EstimatedHours ?? 0,
          ActualHours: task.ActualHours ?? 0,
          Notes: task.Notes ?? null,
          UpdatedBy: user?.employeeId ?? "system",
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
              MaintenanceWork: { connect: { MaintenanceWorkID: maintenanceWorkId } },
              CreatedBy: user?.employeeId ?? "system",
            },
          });
        }

        // Handle task tools
        const tools = task.ToolsUsed ?? [];
        const providedToolIds = new Set<string>();

        for (const t of tools) {
          let toolId = t.TaskToolID;

          if (toolId && await tx.taskTool.findUnique({ where: { TaskToolID: toolId } })) {
            // Update existing tool
            await tx.taskTool.update({
              where: { TaskToolID: toolId },
              data: {
                ToolID: t.ToolID ?? undefined,
                QuantityUsed: t.QuantityUsed ?? undefined,
                Unit: t.Unit ?? undefined,
                SourceType: parseToolSourceType(t.SourceType),
                CostPerUnit: t.CostPerUnit ?? undefined,
                TotalCost: t.TotalCost ?? undefined,
                Notes: t.Notes ?? undefined,
                UpdatedBy: user?.employeeId ?? "system",
              },
            });
          } else {
            // Create new tool
            toolId = await generateFormattedID("TSKT");
            await tx.taskTool.create({
              data: {
                TaskToolID: toolId,
                TaskID: taskId,
                ToolID: t.ToolID ?? null,
                QuantityUsed: t.QuantityUsed!,
                Unit: t.Unit!,
                SourceType: parseToolSourceType(t.SourceType),
                CostPerUnit: t.CostPerUnit ?? 0,
                TotalCost: t.TotalCost ?? 0,
                Notes: t.Notes ?? null,
                CreatedBy: user?.employeeId ?? "system",
                UpdatedBy: user?.employeeId ?? "system",
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
        .map((t) => t.TaskID)
        .filter((id) => !providedTaskIds.has(id));

      if (toDelete.length > 0) {
        await tx.taskTool.deleteMany({ where: { TaskID: { in: toDelete } } });
        await tx.task.deleteMany({ where: { TaskID: { in: toDelete } } });
      }

      return results;
    });

    return NextResponse.json({ updatedTasks }, { status: 200 });
  } catch (err: any) {
    console.error("PUT_TASKS_BY_MAINTENANCE_ERROR", err);
    const message = err?.message ?? "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
};

export const PUT = withCors(updateTasksByMaintenanceWork as any);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
