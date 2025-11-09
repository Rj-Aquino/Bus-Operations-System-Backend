import { NextRequest, NextResponse } from "next/server";
import prisma from "@/client";
import { withCors } from "@/lib/withcors";
import { authenticateRequest } from "@/lib/auth";
import { fetchNewBuses } from "@/lib/fetchExternal";

const getDamageReports = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status"); 

    const whereClause: any = {};
    if (filterStatus) {
      whereClause.Status = filterStatus;
    }

    // Step 1: Fetch damage reports with related BusAssignment + Route
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
      orderBy: { CheckDate: "desc" },
    });

    // Step 2: Fetch bus data from external source (with fallback)
    const buses = await fetchNewBuses();
    const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];

    // Step 3: Create a lookup map for quick plate number retrieval
    const busMap = Object.fromEntries(
      busesArr.map((b: any) => [b.bus_id ?? b.busId, b])
    );

    // Step 4: Format the output
    const formatted = damageReports.map((report) => {
      const bus = busMap[report.BusAssignment?.BusID ?? ""];

      return {
        DamageReportID: report.DamageReportID,
        BusPlateNumber: bus?.plate_number ?? bus?.license_plate ?? null,

        Status: report.Status,
        Note: report.Note,
        CheckDate: report.CheckDate,
        CreatedAt: report.CreatedAt,
        UpdatedAt: report.UpdatedAt,
        CreatedBy: report.CreatedBy,
        UpdatedBy: report.UpdatedBy,

        // Vehicle condition checks
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
    });

    return NextResponse.json(formatted, { status: 200 });
  } catch (err) {
    console.error("GET_DAMAGE_REPORTS_ERROR", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

export const GET = withCors(getDamageReports);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
