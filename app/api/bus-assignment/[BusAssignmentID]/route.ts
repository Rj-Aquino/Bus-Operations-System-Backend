import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { updateQuotaPolicy } from '@/lib/quotaPolicy';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';

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
    console.log('Received data (PUT /bus-assignment/[BusAssignmentID]):', data);

    const [driverSuffix, conductorSuffix] = [data.DriverID, data.ConductorID].map(id => id?.split('-')[1]);
    if (driverSuffix === conductorSuffix) {
      return NextResponse.json({ error: 'Driver and Conductor cannot be the same person' }, { status: 400 });
    }

    // Fetch current RegularBusAssignment and QuotaPolicies
    const existing = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      select: {
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
            QuotaPolicies: { select: { QuotaPolicyID: true } },
          },
        },
      },
    });

    if (!existing?.RegularBusAssignment) {
      return NextResponse.json({ error: 'BusAssignment or RegularBusAssignment not found' }, { status: 404 });
    }

    const regularBusAssignmentID = existing.RegularBusAssignment.RegularBusAssignmentID;

    // Update BusAssignment and RegularBusAssignment
    await prisma.busAssignment.update({
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
    });

    // Delete existing quota policies for this RegularBusAssignment
    await prisma.quota_Policy.deleteMany({
      where: { RegularBusAssignmentID: regularBusAssignmentID },
    });

    // Create new quota policies
    if (Array.isArray(data.QuotaPolicy)) {
      for (const qp of data.QuotaPolicy) {
        const { type, value, StartDate, EndDate } = qp;

        if (!type || value == null) {
          return NextResponse.json(
            { error: 'Each quota policy must have type and value.' },
            { status: 400 }
          );
        }

        if (!StartDate || !EndDate) {
          return NextResponse.json(
            { error: `Each quota policy must have StartDate and EndDate.` },
            { status: 400 }
          );
        }

        const createdQuotaPolicy = await prisma.quota_Policy.create({
          data: {
            QuotaPolicyID: generateFormattedID("QP"),
            RegularBusAssignmentID: regularBusAssignmentID,
            StartDate: new Date(StartDate),
            EndDate: new Date(EndDate),
          },
        });

        if (type.toUpperCase() === 'FIXED') {
          await prisma.fixed.create({
            data: {
              FQuotaPolicyID: createdQuotaPolicy.QuotaPolicyID,
              Quota: value,
            },
          });
        } else if (type.toUpperCase() === 'PERCENTAGE') {
          await prisma.percentage.create({
            data: {
              PQuotaPolicyID: createdQuotaPolicy.QuotaPolicyID,
              Percentage: value,
            },
          });
        } else {
          return NextResponse.json(
            { error: `Invalid quota policy type: ${type}` },
            { status: 400 }
          );
        }
      }
    }

    // Refetch updated bus assignment with quota policies
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
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
                StartDate: true,
                EndDate: true,
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
    let { IsDeleted } = body;

    if (typeof IsDeleted !== 'boolean') {
      return NextResponse.json({ error: '`isDeleted` must be a boolean' }, { status: 400 });
    }

    IsDeleted = !IsDeleted;

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
