import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';

/**
 * POST /api/damage-report
 * Creates a new damage report for a completed rental
 */
const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();
    const {
      RentalRequestID,
      RentalBusAssignmentID,
      vehicleCondition,
      note,
      checkDate
    } = body;

    // Validate required fields
    if (!RentalRequestID || !RentalBusAssignmentID) {
      return NextResponse.json(
        { error: 'RentalRequestID and RentalBusAssignmentID are required' },
        { status: 400 }
      );
    }

    // Verify that the rental request exists and is completed
    const rentalRequest = await prisma.rentalRequest.findUnique({
      where: { RentalRequestID },
      include: {
        RentalBusAssignment: true
      }
    });

    if (!rentalRequest) {
      return NextResponse.json(
        { error: 'Rental request not found' },
        { status: 404 }
      );
    }

    if (rentalRequest.Status !== 'Completed') {
      return NextResponse.json(
        { error: 'Damage reports can only be created for completed rentals' },
        { status: 400 }
      );
    }

    // Verify RentalBusAssignment exists
    if (!rentalRequest.RentalBusAssignment || rentalRequest.RentalBusAssignmentID !== RentalBusAssignmentID) {
      return NextResponse.json(
        { error: 'Invalid RentalBusAssignmentID' },
        { status: 400 }
      );
    }

    // Generate ID for the damage report
    const DamageReportID = await generateFormattedID('DR');

    // Parse vehicle condition from object to boolean fields
    const damageData: any = {
      DamageReportID,
      RentalRequestID,
      RentalBusAssignmentID,
      Note: note || null,
      CheckDate: checkDate ? new Date(checkDate) : new Date(),
      CreatedBy: user?.userId || null,
    };

    // Map vehicle condition object to individual boolean fields
    if (vehicleCondition && typeof vehicleCondition === 'object') {
      damageData.Battery = vehicleCondition.Battery || false;
      damageData.Lights = vehicleCondition.Lights || false;
      damageData.Oil = vehicleCondition.Oil || false;
      damageData.Water = vehicleCondition.Water || false;
      damageData.Brake = vehicleCondition.Brake || false;
      damageData.Air = vehicleCondition.Air || false;
      damageData.Gas = vehicleCondition.Gas || false;
      damageData.Engine = vehicleCondition.Engine || false;
      damageData.TireCondition = vehicleCondition['Tire Condition'] || false;
    }

    // Auto-assign status based on damage items
    // Note: false = damaged/issue found, true = no damage/OK
    // If ALL items are true (all OK), set status to NA (no damage found)
    // If ANY item is false (has damage), set status to Pending (needs review)
    const allItemsOk = damageData.Battery && damageData.Lights && damageData.Oil && 
                       damageData.Water && damageData.Brake && damageData.Air && 
                       damageData.Gas && damageData.Engine && damageData.TireCondition;
    
    damageData.Status = allItemsOk ? 'NA' : 'Pending';

    // Create the damage report
    const damageReport = await prisma.damageReport.create({
      data: damageData,
      include: {
        RentalRequest: true,
        RentalBusAssignment: {
          include: {
            BusAssignment: true
          }
        }
      }
    });

    return NextResponse.json(damageReport, { status: 201 });
  } catch (err) {
    console.error('CREATE_DAMAGE_REPORT_ERROR', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create damage report' },
      { status: 500 }
    );
  }
};

/**
 * GET /api/damage-report?rentalRequestId=xxx
 * Retrieves damage reports for a specific rental request
 * GET /api/damage-report
 * Retrieves all damage reports
 */
const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rentalRequestId = searchParams.get('rentalRequestId');
    const includeNA = searchParams.get('includeNA') === 'true';

    // Build where clause
    // By default, exclude NA status (only show reports with actual damage)
    // Use ?includeNA=true to show all reports including NA
    const whereClause: any = {};
    
    if (rentalRequestId) {
      whereClause.RentalRequestID = rentalRequestId;
    }
    
    if (!includeNA) {
      whereClause.Status = { not: 'NA' };
    }

    const damageReports = await prisma.damageReport.findMany({
      where: whereClause,
      include: {
        RentalRequest: {
          select: {
            RentalRequestID: true,
            CustomerName: true,
            Status: true
          }
        },
        RentalBusAssignment: {
          include: {
            BusAssignment: {
              select: {
                BusID: true,
                BusAssignmentID: true
              }
            }
          }
        }
      },
      orderBy: {
        CheckDate: 'desc'
      }
    });

    return NextResponse.json(damageReports, { status: 200 });
  } catch (err) {
    console.error('GET_DAMAGE_REPORTS_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to retrieve damage reports' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/damage-report?damageReportId=xxx
 * Deletes a specific damage report
 */
const deleteHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const damageReportId = searchParams.get('damageReportId');

    if (!damageReportId) {
      return NextResponse.json(
        { error: 'damageReportId is required' },
        { status: 400 }
      );
    }

    // Check if damage report exists
    const existingReport = await prisma.damageReport.findUnique({
      where: { DamageReportID: damageReportId }
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: 'Damage report not found' },
        { status: 404 }
      );
    }

    // Delete the damage report
    await prisma.damageReport.delete({
      where: { DamageReportID: damageReportId }
    });

    return NextResponse.json(
      { message: 'Damage report deleted successfully' },
      { status: 200 }
    );
  } catch (err) {
    console.error('DELETE_DAMAGE_REPORT_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to delete damage report' },
      { status: 500 }
    );
  }
};

/**
 * PATCH /api/damage-report?damageReportId=xxx
 * Updates the status of a damage report
 */
const patchHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const damageReportId = searchParams.get('damageReportId');

    if (!damageReportId) {
      return NextResponse.json(
        { error: 'damageReportId is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status: reportStatus } = body;

    if (!reportStatus) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    // Validate status value
    if (!['Pending', 'Accepted', 'Rejected'].includes(reportStatus)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be Pending, Accepted, or Rejected' },
        { status: 400 }
      );
    }

    // Check if damage report exists
    const existingReport = await prisma.damageReport.findUnique({
      where: { DamageReportID: damageReportId }
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: 'Damage report not found' },
        { status: 404 }
      );
    }

    // Update the damage report status
    const updatedReport = await prisma.damageReport.update({
      where: { DamageReportID: damageReportId },
      data: {
        Status: reportStatus,
        UpdatedBy: user?.userId || null,
      },
      include: {
        RentalRequest: {
          select: {
            RentalRequestID: true,
            CustomerName: true,
            Status: true
          }
        },
        RentalBusAssignment: {
          include: {
            BusAssignment: {
              select: {
                BusID: true,
                BusAssignmentID: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(updatedReport, { status: 200 });
  } catch (err) {
    console.error('UPDATE_DAMAGE_REPORT_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to update damage report' },
      { status: 500 }
    );
  }
};

export const POST = withCors(postHandler);
export const GET = withCors(getHandler);
export const PATCH = withCors(patchHandler);
export const DELETE = withCors(deleteHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
