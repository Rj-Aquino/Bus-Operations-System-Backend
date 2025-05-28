import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database
import { updateQuotaPolicy } from '@/lib/quotaPolicy';
import { authenticateRequest } from '@/lib/auth';

export async function PUT(request: Request) {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const url = new URL(request.url);
    const BusAssignmentID = url.pathname.split('/').pop();

    if (!BusAssignmentID) {
      return NextResponse.json({ error: 'BusAssignmentID is required' }, { status: 400 });
    }

    const data = await request.json();

    // === Validate Driver and Conductor are not the same ===
    const [driverSuffix, conductorSuffix] = [data.DriverID, data.ConductorID].map(id => id?.split('-')[1]);
    if (driverSuffix === conductorSuffix) {
      return NextResponse.json({ error: 'Driver and Conductor cannot be the same person' }, { status: 400 });
    }

    // === Fetch existing RegularBusAssignment and QuotaPolicyID ===
    const existing = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      select: {
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
            quotaPolicy: { select: { QuotaPolicyID: true } },
          },
        },
      },
    });

    if (!existing?.RegularBusAssignment) {
      return NextResponse.json({ error: 'BusAssignment or RegularBusAssignment not found' }, { status: 404 });
    }

    const QuotaPolicyID = existing.RegularBusAssignment.quotaPolicy?.QuotaPolicyID;

    // === Update QuotaPolicy directly (if type & value are provided) ===
    if (QuotaPolicyID && data.type && data.value != null) {
      await updateQuotaPolicy(QuotaPolicyID, {
        type: data.type,
        value: data.value,
        StartDate: data.StartDate,
        EndDate: data.EndDate,
      });
    }

    // === Update BusAssignment and RegularBusAssignment ===
    const updated = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: {
        BusID: data.BusID,
        RouteID: data.RouteID,
        RegularBusAssignment: {
          update: {
            DriverID: data.DriverID,
            ConductorID: data.ConductorID,
          },
        },
      },
      select: {
        BusAssignmentID: true,
        BusID: true,
        RouteID: true,
        AssignmentDate: true,
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            quotaPolicy: {
              select: {
                QuotaPolicyID: true,
                Fixed: { select: { Quota: true } },
                Percentage: { select: { Percentage: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updated, { status: 200 });

  } catch (error) {
    console.error('UPDATE_ASSIGNMENT_ERROR', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { user, error, status } = await authenticateRequest(req);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const url = new URL(req.url);
    const BusAssignmentID = url.pathname.split('/').pop();

    if (!BusAssignmentID) {
      return NextResponse.json({ error: 'BusAssignmentID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { IsDeleted } = body;

    if (typeof IsDeleted !== 'boolean') {
      return NextResponse.json({ error: '`isDeleted` must be a boolean' }, { status: 400 });
    }

    const updated = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: { IsDeleted: IsDeleted },
      select: {
        IsDeleted: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });

  } catch (error) {
    console.error('PATCH_ASSIGNMENT_ERROR', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}