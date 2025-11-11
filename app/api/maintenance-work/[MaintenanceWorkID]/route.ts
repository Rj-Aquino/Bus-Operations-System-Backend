import { NextRequest, NextResponse } from "next/server";
import prisma from "@/client";
import { withCors } from "@/lib/withcors";
import { authenticateRequest } from "@/lib/auth";
import { MaintenanceStatus, MaintenancePriority } from "@prisma/client";

const putMaintenanceWork = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    // ✅ Extract MaintenanceWorkID from URL
    const url = new URL(request.url);
    const MaintenanceWorkID = url.pathname.split("/").pop();

    if (!MaintenanceWorkID) {
      return NextResponse.json(
        { error: "MaintenanceWorkID is required in the URL." },
        { status: 400 }
      );
    }

    // ✅ Parse JSON body
    const body = await request.json();

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

    // ✅ Validate enums (Status, Priority)
    const validStatuses = Object.values(MaintenanceStatus);
    const validPriorities = Object.values(MaintenancePriority);

    if (Status && !validStatuses.includes(Status)) {
      return NextResponse.json(
        { error: `Invalid Status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    if (Priority && !validPriorities.includes(Priority)) {
      return NextResponse.json(
        {
          error: `Invalid Priority. Must be one of: ${validPriorities.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // ✅ Ensure the record exists
    const existing = await prisma.maintenanceWork.findUnique({
      where: { MaintenanceWorkID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "MaintenanceWork not found." },
        { status: 404 }
      );
    }

    // ✅ Validation: Prevent CompletedDate update if not Completed
    const finalStatus = Status ?? existing.Status; // current or new status

    if (CompletedDate && finalStatus !== "Completed") {
      return NextResponse.json(
        {
          error:
            'Cannot update CompletedDate unless Status is set to "Completed".',
        },
        { status: 400 }
      );
    }

    // ✅ Update MaintenanceWork
    const updatedWork = await prisma.maintenanceWork.update({
      where: { MaintenanceWorkID },
      data: {
        Status,
        Priority,
        WorkTitle,
        ScheduledDate: ScheduledDate ? new Date(ScheduledDate) : undefined,
        DueDate: DueDate ? new Date(DueDate) : undefined,
        CompletedDate: CompletedDate ? new Date(CompletedDate) : undefined,
        EstimatedCost:
          typeof EstimatedCost === "number" ? EstimatedCost : undefined,
        ActualCost: typeof ActualCost === "number" ? ActualCost : undefined,
        WorkNotes,
        UpdatedBy: user?.employeeId ?? null,
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

    return NextResponse.json({ updated: updatedWork }, { status: 200 });
  } catch (err) {
    console.error("PUT_MAINTENANCE_WORK_ERROR", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const PUT = withCors(putMaintenanceWork);
export const OPTIONS = withCors(() =>
  Promise.resolve(new NextResponse(null, { status: 204 }))
);
