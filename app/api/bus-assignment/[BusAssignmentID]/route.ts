import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { updateQuotaPolicy } from '@/lib/quotaPolicy';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

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

    const [driverSuffix, conductorSuffix] = [data.DriverID, data.ConductorID].map(id => id?.split('-')[1]);
    if (driverSuffix === conductorSuffix) {
      return NextResponse.json({ error: 'Driver and Conductor cannot be the same person' }, { status: 400 });
    }

    // Fetch current RegularBusAssignment and QuotaPolicy
    const existing = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      select: {
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
            quota_Policy: { select: { QuotaPolicyID: true } },
          },
        },
      },
    });

    if (!existing?.RegularBusAssignment) {
      return NextResponse.json({ error: 'BusAssignment or RegularBusAssignment not found' }, { status: 404 });
    }

    const oldRegularBusAssignmentID = existing.RegularBusAssignment.RegularBusAssignmentID;
    const QuotaPolicyID = existing.RegularBusAssignment.quota_Policy?.[0]?.QuotaPolicyID;

    // Update BusAssignment and RegularBusAssignment
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
            RegularBusAssignmentID: true,
            DriverID: true,
            ConductorID: true,
            quota_Policy: {
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

    // If the RegularBusAssignmentID changed, update Quota_Policy's RegularBusAssignmentID
    const newRegularBusAssignmentID = updated.RegularBusAssignment?.RegularBusAssignmentID;
    if (
      QuotaPolicyID &&
      newRegularBusAssignmentID &&
      newRegularBusAssignmentID !== oldRegularBusAssignmentID
    ) {
      await prisma.quota_Policy.update({
        where: { QuotaPolicyID },
        data: { RegularBusAssignmentID: newRegularBusAssignmentID },
      });
    }

    // If quota policy update is requested
    if (QuotaPolicyID && data.type && data.value != null) {
      await updateQuotaPolicy(QuotaPolicyID, {
        type: data.type,
        value: data.value,
        StartDate: data.StartDate,
        EndDate: data.EndDate,
        RegularBusAssignmentID: newRegularBusAssignmentID,
      });
    }

    // Refetch for latest quota policy info
    const refreshed = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      select: {
        BusAssignmentID: true,
        BusID: true,
        RouteID: true,
        AssignmentDate: true,
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            quota_Policy: {
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
};

export const PUT = withCors(putHandler);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
