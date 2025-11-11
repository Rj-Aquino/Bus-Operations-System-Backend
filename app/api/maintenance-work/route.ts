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

    const whereClause: any = {};
    if (filterStatus) whereClause.Status = filterStatus;
    if (filterPriority) whereClause.Priority = filterPriority;

    // ✅ Step 1: Fetch MaintenanceWork with DamageReport and BusAssignment
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
      orderBy: { CreatedAt: "desc" },
    });

    // ✅ Step 2: Fetch bus data from external source (with fallback)
    const buses = await fetchNewBuses();
    const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];

    // ✅ Step 3: Create a lookup map for quick plate number retrieval
    const busMap = Object.fromEntries(
      busesArr.map((b: any) => [b.bus_id ?? b.busId, b])
    );

    // ✅ Step 4: Format the output
    const formatted = maintenanceWorks.map((work) => {
      const bus = busMap[work.DamageReport?.BusAssignment?.BusID ?? ""];

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
    });

    return NextResponse.json(formatted, { status: 200 });
  } catch (err) {
    console.error("GET_MAINTENANCE_WORK_ERROR", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = withCors(getMaintenanceWork);
export const OPTIONS = withCors(() =>
  Promise.resolve(new NextResponse(null, { status: 204 }))
);
