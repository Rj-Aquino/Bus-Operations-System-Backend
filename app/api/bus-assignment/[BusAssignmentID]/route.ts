import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database

export async function PUT(request: Request) {
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

    // === Soft Delete Case ===
    if (data.IsDeleted === true) {
      const updated = await prisma.busAssignment.update({
        where: { BusAssignmentID },
        data: { IsDeleted: true },
        select: { BusAssignmentID: true, IsDeleted: true },
      });
      return NextResponse.json(updated, { status: 200 });
    }

    // === Fetch Existing Data (minimal fields) ===
    const existing = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      select: {
        BusAssignmentID: true,
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
            quotaPolicy: {
              select: {
                QuotaPolicyID: true,
              },
            },
          },
        },
      },
    });

    if (!existing?.RegularBusAssignment) {
      return NextResponse.json({ error: 'BusAssignment or RegularBusAssignment not found' }, { status: 404 });
    }

    // === Conditionally Update QuotaPolicy ===
    const quotaPolicyId = existing.RegularBusAssignment.quotaPolicy?.QuotaPolicyID;
    if (quotaPolicyId && data.type && data.value) {
      const baseUrl = process.env.APPLICATION_URL;
      if (!baseUrl) {
        return NextResponse.json({ error: 'Base URL not defined' }, { status: 500 });
      }

      const quotaResponse = await fetch(`${baseUrl}/api/quota-assignment/${quotaPolicyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: data.type,
          value: data.value,
          StartDate: data.StartDate,
          EndDate: data.EndDate,
        }),
      });

      if (!quotaResponse.ok) {
        const quotaError = await quotaResponse.json();
        return NextResponse.json(
          { error: quotaError?.error || 'Failed to update QuotaPolicy' },
          { status: 502 }
        );
      }
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
        IsDeleted: true,
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
    console.error('[UPDATE_ASSIGNMENT_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const url = new URL(req.url);
    const BusAssignmentID = url.pathname.split('/').pop();

    if (!BusAssignmentID) {
      return NextResponse.json({ error: 'BusAssignmentID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { isDeleted } = body;

    if (typeof isDeleted !== 'boolean') {
      return NextResponse.json({ error: '`isDeleted` must be a boolean' }, { status: 400 });
    }

    const updated = await prisma.busAssignment.update({
      where: { BusAssignmentID },
      data: { IsDeleted: isDeleted },
      select: {
        BusAssignmentID: true,
        IsDeleted: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });

  } catch (error) {
    console.error('[PATCH_ASSIGNMENT_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}