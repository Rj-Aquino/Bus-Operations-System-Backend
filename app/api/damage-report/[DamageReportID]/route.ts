import { NextRequest, NextResponse } from "next/server";
import prisma from "@/client";
import { withCors } from "@/lib/withcors";
import { authenticateRequest } from "@/lib/auth";
import { generateFormattedID } from '@/lib/idGenerator'
import { DamageReportStatus } from "@prisma/client";

const patchDamageReport = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    // ✅ Extract damage_report_id from URL
    const url = new URL(request.url);
    const damage_report_id = url.pathname.split('/').pop();

    // ✅ Error if ID is missing
    if (!damage_report_id) {
      return NextResponse.json(
        { error: 'damage_report_id is required in the URL.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status: newStatus } = body ?? {};

    // ✅ Validate status
    if (typeof newStatus !== "string") {
      return NextResponse.json(
        { error: "Invalid request body. Expecting { status }" },
        { status: 400 }
      );
    }

    const validStatuses: DamageReportStatus[] = [
      DamageReportStatus.NA,
      DamageReportStatus.Pending,
      DamageReportStatus.Accepted,
      DamageReportStatus.Rejected,
    ];

    if (!validStatuses.includes(newStatus as DamageReportStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // ✅ Update the damage report
    const updatedReport = await prisma.damageReport.update({
      where: { DamageReportID: damage_report_id },
      data: {
        Status: newStatus as DamageReportStatus,
        UpdatedBy: user?.employeeId ?? null,
      },
      select: {
        DamageReportID: true,
        Status: true,
        UpdatedBy: true,
        UpdatedAt: true,
      },
    });

    // ✅ Create MaintenanceWork if Accepted
    if (newStatus === "Accepted") {
      const existingWork = await prisma.maintenanceWork.findUnique({
        where: { DamageReportID: damage_report_id },
      });

      if (!existingWork) {
        const maintenanceWorkID = await generateFormattedID("MW");
        await prisma.maintenanceWork.create({
          data: {
            MaintenanceWorkID: maintenanceWorkID,
            DamageReportID: damage_report_id,
            CreatedBy: user?.employeeId ?? null,
          },
        });
      }
    }

    return NextResponse.json({ updated: updatedReport }, { status: 200 });
  } catch (err) {
    console.error("PATCH_DAMAGE_REPORT_ERROR", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

export const PATCH = withCors(patchDamageReport);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));