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
      BusAssignmentID,
      BusTripID,
      Notes,
      Status: requestedStatus,
      VehicleCondition, // object with boolean fields
    } = body;

    console.log('[Vehicle Check] Received data:', { BusAssignmentID, BusTripID, VehicleCondition });

    if (!BusTripID) {
      return NextResponse.json(
        { error: 'BusTripID is required for vehicle check' },
        { status: 400 }
      );
    }

    if (!BusAssignmentID) {
      return NextResponse.json(
        { error: 'BusAssignmentID is required for vehicle check' },
        { status: 400 }
      );
    }

    // Verify the bus trip exists
    const busTrip = await prisma.busTrip.findUnique({
      where: { BusTripID },
      include: {
        regularBusAssignment: {
          include: {
            BusAssignment: true,
          },
        },
        DamageReports: true,
      },
    });

    if (!busTrip) {
      return NextResponse.json(
        { error: 'Bus trip not found' },
        { status: 404 }
      );
    }

    // Check if a damage report already exists for this trip
    if (busTrip.DamageReports.length > 0) {
      return NextResponse.json(
        { error: 'Vehicle check already completed for this trip' },
        { status: 400 }
      );
    }

    // Generate new ID
    const DamageReportID = await generateFormattedID('DR');

    // Map VehicleCondition object to schema boolean fields
    const damageData: any = {
      DamageReportID,
      BusTripID,
      BusAssignmentID, // Use the provided BusAssignmentID
      Note: Notes || null,
      CheckDate: new Date(),
      CreatedBy: user?.userId || 'mock-admin',
      UpdatedBy: user?.userId || 'mock-admin',
    };

    const defaultCondition = true;
    
    // Map the VehicleCondition object properly
    if (VehicleCondition && typeof VehicleCondition === 'object') {
      // Handle both display names and backend field names
      damageData.Battery = VehicleCondition.Battery ?? defaultCondition;
      damageData.Lights = VehicleCondition.Lights ?? defaultCondition;
      damageData.Oil = VehicleCondition.Oil ?? defaultCondition;
      damageData.Water = VehicleCondition.Water ?? defaultCondition;
      damageData.Brake = VehicleCondition.Brake ?? defaultCondition;
      damageData.Air = VehicleCondition.Air ?? defaultCondition;
      damageData.Gas = VehicleCondition.Gas ?? defaultCondition;
      damageData.Engine = VehicleCondition.Engine ?? defaultCondition;
      
      // Handle both "Tire Condition" and "TireCondition"
      damageData.TireCondition = VehicleCondition.TireCondition ?? 
                                  VehicleCondition['Tire Condition'] ?? 
                                  defaultCondition;
    } else {
      // Default all to true (no damage)
      damageData.Battery = defaultCondition;
      damageData.Lights = defaultCondition;
      damageData.Oil = defaultCondition;
      damageData.Water = defaultCondition;
      damageData.Brake = defaultCondition;
      damageData.Air = defaultCondition;
      damageData.Gas = defaultCondition;
      damageData.Engine = defaultCondition;
      damageData.TireCondition = defaultCondition;
    }

    // Auto-assign status based on condition
    const conditionValues = [
      damageData.Battery,
      damageData.Lights,
      damageData.Oil,
      damageData.Water,
      damageData.Brake,
      damageData.Air,
      damageData.Gas,
      damageData.Engine,
      damageData.TireCondition
    ];
    
    const allOk = conditionValues.every(val => val === true);
    damageData.Status = allOk ? 'NA' : 'Pending';

    // Override with requested status if valid
    if (requestedStatus && ['Pending', 'Accepted', 'Rejected', 'NA'].includes(requestedStatus)) {
      damageData.Status = requestedStatus;
    }

    console.log('[Vehicle Check] Creating damage report with data:', damageData);

    // Create the damage report
    const damageReport = await prisma.damageReport.create({
      data: damageData,
      include: {
        BusAssignment: true,
        BusTrip: {
          include: {
            regularBusAssignment: {
              include: {
                BusAssignment: true
              }
            }
          }
        },
      },
    });

    console.log('[Vehicle Check] Damage report created successfully:', damageReport.DamageReportID);

    // Clear relevant caches
    const cachesToClear = [
      CACHE_KEYS.BUS_OPERATIONS_ALL,
      CACHE_KEYS.BUS_OPERATIONS_INOPERATION,
      CACHE_KEYS.BUS_OPERATIONS_NOTREADY,
      CACHE_KEYS.BUS_OPERATIONS_NOTSTARTED,
      CACHE_KEYS.DAMAGE_REPORT_ALL,
      CACHE_KEYS.DAMAGE_REPORT_PENDING,
      CACHE_KEYS.DAMAGE_REPORT_NA,
      CACHE_KEYS.DASHBOARD
    ].filter((key): key is string => !!key)

    await Promise.all(cachesToClear.map(key => delCache(key)));

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