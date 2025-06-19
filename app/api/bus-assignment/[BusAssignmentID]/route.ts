import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';
import { delCache, CACHE_KEYS } from '@/lib/cache';

const ASSIGNMENTS_CACHE_KEY = CACHE_KEYS.BUS_ASSIGNMENTS ?? '';

const putHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const BusAssignmentID = url.pathname.split('/').pop();

    if (!BusAssignmentID) {
      return NextResponse.json({ error: 'BusAssignmentID is required' }, { status: 400 });
    }

    const data = await request.json();

    // Fetch current RegularBusAssignment
    const existing = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      select: {
        BusID: true,
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
            DriverID: true,
            ConductorID: true,
          },
        },
      },
    });

    if (!existing?.RegularBusAssignment) {
      return NextResponse.json({ error: 'BusAssignment or RegularBusAssignment not found' }, { status: 404 });
    }

    // 1. BusID must not already be assigned (not deleted, not this assignment)
    const existingBus = await prisma.busAssignment.findFirst({
      where: {
        BusID: data.BusID,
        IsDeleted: false,
        NOT: { BusAssignmentID }
      }
    });
    if (existingBus) {
      return NextResponse.json({ error: 'Bus is already assigned.' }, { status: 400 });
    }

    // 2. DriverID must not already be assigned (not deleted, not this assignment)
    const existingDriver = await prisma.regularBusAssignment.findFirst({
      where: {
        DriverID: data.DriverID,
        BusAssignment: { IsDeleted: false },
        NOT: { RegularBusAssignmentID: existing.RegularBusAssignment.RegularBusAssignmentID }
      }
    });
    if (existingDriver) {
      return NextResponse.json({ error: 'Driver is already assigned.' }, { status: 400 });
    }

    // 3. ConductorID must not already be assigned (not deleted, not this assignment)
    const existingConductor = await prisma.regularBusAssignment.findFirst({
      where: {
        ConductorID: data.ConductorID,
        BusAssignment: { IsDeleted: false },
        NOT: { RegularBusAssignmentID: existing.RegularBusAssignment.RegularBusAssignmentID }
      }
    });
    if (existingConductor) {
      return NextResponse.json({ error: 'Conductor is already assigned.' }, { status: 400 });
    }

    // Update BusAssignment and RegularBusAssignment
    const updated = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: {
        BusID: data.BusID,
        RouteID: data.RouteID,
        UpdatedBy: user?.employeeId || null,
        RegularBusAssignment: {
          update: {
            DriverID: data.DriverID,
            ConductorID: data.ConductorID,
            UpdatedBy: user?.employeeId || null,
          },
        },
      },
      select: {
        BusAssignmentID: true,
        BusID: true,
        RouteID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
            DriverID: true,
            ConductorID: true,
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
                StartDate: true,
                EndDate: true,
                CreatedAt: true,
                UpdatedAt: true,
                CreatedBy: true,
                UpdatedBy: true,
                Fixed: { select: { Quota: true, CreatedAt: true, UpdatedAt: true, CreatedBy: true, UpdatedBy: true } },
                Percentage: { select: { Percentage: true, CreatedAt: true, UpdatedAt: true, CreatedBy: true, UpdatedBy: true } },
              },
            },
          },
        },
      },
    });

    const newRegularBusAssignmentID = updated.RegularBusAssignment?.RegularBusAssignmentID;

    // Delete existing quota policies for this RegularBusAssignment
    await prisma.quota_Policy.deleteMany({
      where: { RegularBusAssignmentID: newRegularBusAssignmentID },
    });

    // Create new quota policies
    if (Array.isArray(data.quotaPolicies)) {
      for (const qp of data.quotaPolicies) {
        const quotaPolicyID = generateFormattedID("QP");
        // Accept both camelCase and PascalCase for dates
        const startDate = qp.startDate || qp.StartDate;
        const endDate = qp.endDate || qp.EndDate;
        const quotaPolicyData: any = {
          QuotaPolicyID: quotaPolicyID,
          RegularBusAssignmentID: newRegularBusAssignmentID!,
          ...(startDate && { StartDate: new Date(startDate) }),
          ...(endDate && { EndDate: new Date(endDate) }),
          CreatedBy: user?.employeeId || null,
          UpdatedBy: user?.employeeId || null,
        };

        if (qp.type && qp.type.toUpperCase() === 'FIXED') {
          quotaPolicyData.Fixed = {
            create: {
              Quota: qp.value,
              CreatedBy: user?.employeeId || null,
              UpdatedBy: user?.employeeId || null,
            },
          };
        } else if (qp.type && qp.type.toUpperCase() === 'PERCENTAGE') {
          quotaPolicyData.Percentage = {
            create: {
              Percentage: qp.value,
              CreatedBy: user?.employeeId || null,
              UpdatedBy: user?.employeeId || null,
            },
          };
        }

        await prisma.quota_Policy.create({
          data: quotaPolicyData,
        });
      }
    }

    // Refetch updated bus assignment with quota policies
    const refreshed = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      select: {
        BusAssignmentID: true,
        BusID: true,
        RouteID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
                StartDate: true,
                EndDate: true,
                CreatedAt: true,
                UpdatedAt: true,
                CreatedBy: true,
                UpdatedBy: true,
                Fixed: { select: { Quota: true, CreatedAt: true, UpdatedAt: true, CreatedBy: true, UpdatedBy: true } },
                Percentage: { select: { Percentage: true, CreatedAt: true, UpdatedAt: true, CreatedBy: true, UpdatedBy: true } },
              },
            },
          },
        },
      },
    });

    await delCache(ASSIGNMENTS_CACHE_KEY);
    await delCache(CACHE_KEYS.BUSES ?? '');
    await delCache(CACHE_KEYS.DRIVERS ?? '');
    await delCache(CACHE_KEYS.CONDUCTORS ?? '');
    await delCache(CACHE_KEYS.DASHBOARD ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTREADY ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTSTARTED ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_INOPERATION ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_ALL ?? '');

    return NextResponse.json(refreshed, { status: 200 });
  } catch (error) {
    console.error('UPDATE_ASSIGNMENT_ERROR', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
};

const patchHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const BusAssignmentID = url.pathname.split('/').pop();

    if (!BusAssignmentID) {
      return NextResponse.json({ error: 'BusAssignmentID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { IsDeleted } = body;

    if (typeof IsDeleted !== 'boolean') {
      return NextResponse.json({ error: '`IsDeleted` must be a boolean' }, { status: 400 });
    }

    const updated = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: { 
        IsDeleted,
        UpdatedBy: user?.employeeId || null,
      },
      select: {
        IsDeleted: true,
        UpdatedBy: true,
      },
    });

    await delCache(ASSIGNMENTS_CACHE_KEY);
    await delCache(CACHE_KEYS.BUSES ?? '');
    await delCache(CACHE_KEYS.DRIVERS ?? '');
    await delCache(CACHE_KEYS.CONDUCTORS ?? '');
    await delCache(CACHE_KEYS.DASHBOARD ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTREADY ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTSTARTED ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_INOPERATION ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_ALL ?? '');

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('PATCH_ASSIGNMENT_ERROR', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
};

export const PUT = withCors(putHandler);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
