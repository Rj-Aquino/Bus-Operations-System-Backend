import { NextRequest, NextResponse } from "next/server";
import prisma from "@/client";
import { withCors } from "@/lib/withcors";
import { authenticateRequest } from "@/lib/auth";
import { fetchNewBuses } from "@/lib/fetchExternal";

const getMaintenanceWork = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status");
    const filterPriority = searchParams.get("priority");
    const filterDamageID = searchParams.get("damageId");

    const whereClause: any = {};
    if (filterStatus) whereClause.Status = filterStatus;
    if (filterPriority) whereClause.Priority = filterPriority;
    if (filterDamageID) whereClause.DamageReportID = filterDamageID;

    const maintenanceWorks = await prisma.maintenanceWork.findMany({
      where: whereClause,
      include: {
        DamageReport: {
          include: {
            BusAssignment: true, // Include the BusAssignment here
          },
        },
        Tasks: {
          include: {
            ToolsUsed: true,
          },
        },
      },
      orderBy: { CreatedAt: "desc" },
    });

    const buses = await fetchNewBuses();

    // Create a lookup map for buses
    const busMap = Object.fromEntries(buses.map((b: any) => [b.bus_id, b]));

    const formatted = maintenanceWorks.map((work) => {
      const busID = work.DamageReport?.BusAssignment?.BusID;
      const bus = busMap[busID] || null;

      return {
        MaintenanceWorkID: work.MaintenanceWorkID,
        WorkTitle: work.WorkTitle,
        Priority: work.Priority,
        Status: work.Status,
        WorkNotes: work.WorkNotes,
        DamageReportedBy: work.DamageReport?.CreatedBy || null,
        BusPlateNumber: bus?.plate_number ?? bus?.license_plate ?? null, // correct now
        Tasks: work.Tasks.map((task) => ({
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
          ToolsUsed: task.ToolsUsed.map((tool) => ({
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
    });

    return NextResponse.json(formatted, { status: 200 });
  } catch (err) {
    console.error("GET_MAINTENANCE_WORK_ERROR", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

export const GET = withCors(getMaintenanceWork);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
