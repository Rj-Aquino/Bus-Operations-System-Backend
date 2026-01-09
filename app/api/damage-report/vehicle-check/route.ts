import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';
import { delCache, CACHE_KEYS } from '@/lib/cache';

/**
 * POST /api/damage-report/vehicle-check
 * Creates a new damage report for regular bus operations (post-trip vehicle check)
 */
const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();
    const {
      BusTripID,
      Description,
      Status: requestedStatus,
      VehicleCondition,
      Notes,
    } = body;

    // Validate required fields
    if (!BusTripID) {
      return NextResponse.json(
        { error: 'BusTripID is required for vehicle check' },
        { status: 400 }
      );
    }

    // Verify that the bus trip exists
    const busTrip = await prisma.busTrip.findUnique({
      where: { BusTripID },
      include: {
        regularBusAssignment: {
          include: {
            BusAssignment: true
          }
        },
        DamageReports: true
      }
    });

    if (!busTrip) {
      return NextResponse.json(
        { error: 'Bus trip not found' },
        { status: 404 }
      );
    }

    // Check if a vehicle check already exists for this trip
    if (busTrip.DamageReports && busTrip.DamageReports.length > 0) {
      return NextResponse.json(
        { error: 'Vehicle check already completed for this trip' },
        { status: 400 }
      );
    }

    // Generate ID for the damage report
    const DamageReportID = await generateFormattedID('DR');

    // Parse vehicle condition from object to boolean fields
    const damageData: any = {
      DamageReportID,
      BusTripID,
      Note: Notes || Description || null,
      CheckDate: new Date(),
      CreatedBy: user?.userId || null,
      // RentalRequestID and RentalBusAssignmentID are null for regular bus operations
    };

    // Map vehicle condition object to individual boolean fields
    if (VehicleCondition && typeof VehicleCondition === 'object') {
      damageData.Battery = VehicleCondition.Battery ?? true;
      damageData.Lights = VehicleCondition.Lights ?? true;
      damageData.Oil = VehicleCondition.Oil ?? true;
      damageData.Water = VehicleCondition.Water ?? true;
      damageData.Brake = VehicleCondition.Brake ?? true;
      damageData.Air = VehicleCondition.Air ?? true;
      damageData.Gas = VehicleCondition.Gas ?? true;
      damageData.Engine = VehicleCondition.Engine ?? true;
      damageData.TireCondition = VehicleCondition['Tire Condition'] ?? true;
    } else {
      // Default all to true (no damage) if no vehicle condition provided
      damageData.Battery = true;
      damageData.Lights = true;
      damageData.Oil = true;
      damageData.Water = true;
      damageData.Brake = true;
      damageData.Air = true;
      damageData.Gas = true;
      damageData.Engine = true;
      damageData.TireCondition = true;
    }

    // Auto-assign status based on damage items
    // Note: false = damaged/issue found, true = no damage/OK
    // If ALL items are true (all OK), set status to NA (no damage found)
    // If ANY item is false (has damage), set status to Pending (needs review)
    const allItemsOk = damageData.Battery && damageData.Lights && damageData.Oil && 
                       damageData.Water && damageData.Brake && damageData.Air && 
                       damageData.Gas && damageData.Engine && damageData.TireCondition;
    
    damageData.Status = allItemsOk ? 'NA' : 'Pending';

    // Override with requested status if provided
    if (requestedStatus && ['Pending', 'Resolved', 'NA'].includes(requestedStatus)) {
      damageData.Status = requestedStatus;
    }

    // Create the damage report
    const damageReport = await prisma.damageReport.create({
      data: damageData,
      include: {
        BusTrip: {
          include: {
            regularBusAssignment: {
              include: {
                BusAssignment: true
              }
            }
          }
        }
      }
    });

    // Clear bus operations cache so the vehicle check status is reflected
    const baseKey = CACHE_KEYS.BUS_OPERATIONS_ALL ?? 'bus_operations:all';
    await Promise.all([
      delCache(baseKey),
      delCache(CACHE_KEYS.BUS_OPERATIONS_INOPERATION ?? `${baseKey}_InOperation`),
    ]);

    return NextResponse.json(damageReport, { status: 201 });
  } catch (err) {
    console.error('CREATE_VEHICLE_CHECK_DAMAGE_REPORT_ERROR', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create vehicle check report' },
      { status: 500 }
    );
  }
};

export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
