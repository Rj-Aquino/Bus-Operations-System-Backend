import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database
import { generateFormattedID } from '../../../lib/idGenerator';

export async function GET() {
  try {
    const assignments = await prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: {
          IsDeleted: false,
        },
      },
      select: {
        RegularBusAssignmentID: true,
        DriverID: true,
        ConductorID: true,
        Change: true,
        TripRevenue: true,
        quotaPolicy: {
          select: {
            QuotaPolicyID: true,
            Fixed: {
              select: {
                Quota: true,
              },
            },
            Percentage: {
              select: {
                Percentage: true,
              },
            },
          },
        },
        BusAssignment: {
          select: {
            BusAssignmentID: true,
            AssignmentDate: true,
            Status: true,
            Route: {
              select: {
                RouteID: true,
                RouteName: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('[REGULAR_ASSIGNMENTS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const baseUrl = process.env.APPLICATION_URL;

    // === Validate Required Fields (excluding AssignmentDate) ===
    const requiredFields = ['BusID', 'RouteID', 'DriverID', 'ConductorID', 'QuotaPolicy'];
    for (const field of requiredFields) {
      if (
        !data[field] ||
        (typeof data[field] === 'string' && data[field].trim() === '') ||
        (field === 'QuotaPolicy' &&
          (!data.QuotaPolicy?.type || data.QuotaPolicy.value == null))
      ) {
        return NextResponse.json(
          { error: `Missing or empty required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // === Validate Driver and Conductor are not the same ===
    const [driverSuffix, conductorSuffix] = [data.DriverID, data.ConductorID].map(id => id.split('-')[1]);
    if (driverSuffix === conductorSuffix) {
      return NextResponse.json(
        { error: 'Driver and Conductor cannot be the same person' },
        { status: 400 }
      );
    }

    // === Generate IDs in parallel ===
    const [quotaPolicyResponse, newBusAssignmentID] = await Promise.all([
      fetch(`${baseUrl}/api/quota-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: data.QuotaPolicy.type,
          value: data.QuotaPolicy.value,
        }),
      }),
      generateFormattedID('BA'),
    ]);

    if (!quotaPolicyResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to create QuotaPolicy from API' },
        { status: 502 }
      );
    }

    const newQuotaPolicy = await quotaPolicyResponse.json();

    // === Create BusAssignment with related RegularBusAssignment ===
    const newAssignment = await prisma.busAssignment.create({
      data: {
        BusAssignmentID: newBusAssignmentID,
        BusID: data.BusID,
        RouteID: data.RouteID,
        AssignmentDate: data.AssignmentDate ? new Date(data.AssignmentDate) : new Date(),
        RegularBusAssignment: {
          create: {
            DriverID: data.DriverID,
            ConductorID: data.ConductorID,
            QuotaPolicyID: newQuotaPolicy.QuotaPolicyID,
            Change: data.Change ?? 0,
            TripRevenue: data.TripRevenue ?? 0,
          },
        },
      },
      select: {
        BusAssignmentID: true,
        AssignmentDate: true,
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            Change: true,
            TripRevenue: true,
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

    return NextResponse.json(newAssignment, { status: 201 });

  } catch (error) {
    console.error('[CREATE_ASSIGNMENT_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to create BusAssignment' },
      { status: 500 }
    );
  }
}
