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

    // If rentalRequestId is provided, filter by it
    const whereClause = rentalRequestId ? { RentalRequestID: rentalRequestId } : {};

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

export const POST = withCors(postHandler);
export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
