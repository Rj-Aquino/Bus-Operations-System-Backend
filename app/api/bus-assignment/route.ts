import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database
import { generateFormattedID } from '@/lib/idGenerator';
import { createQuotaPolicy } from '@/lib/quotaPolicy';
import { authenticateRequest } from '@/lib/auth';

export async function GET(request: Request) {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

    return NextResponse.json(assignments, { status: 200 });
  } catch (error) {
    console.error('REGULAR_ASSIGNMENTS_ERROR', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await request.json();

    const requiredFields = ['BusID', 'RouteID', 'DriverID', 'ConductorID'];
    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        return NextResponse.json({ error: `Missing or empty required field: ${field}` }, { status: 400 });
      }
    }

    if (!data.QuotaPolicy?.type || data.QuotaPolicy.value == null) {
      return NextResponse.json({ error: 'Missing or invalid QuotaPolicy' }, { status: 400 });
    }

    const [driverSuffix, conductorSuffix] = [data.DriverID, data.ConductorID].map(id => id.split('-')[1]);
    if (driverSuffix === conductorSuffix) {
      return NextResponse.json({ error: 'Driver and Conductor cannot be the same person' }, { status: 400 });
    }

    // === Create IDs & Related Entities in Parallel ===
    const [busAssignmentID, quotaPolicy] = await Promise.all([
      generateFormattedID('BA'),
      createQuotaPolicy({ type: data.QuotaPolicy.type, value: data.QuotaPolicy.value }),
    ]);

    // === Create BusAssignment in Transaction ===
    const assignment = await prisma.busAssignment.create({
      data: {
        BusAssignmentID: busAssignmentID,
        BusID: data.BusID,
        RouteID: data.RouteID,
        AssignmentDate: data.AssignmentDate ? new Date(data.AssignmentDate) : new Date(),
        RegularBusAssignment: {
          create: {
            DriverID: data.DriverID,
            ConductorID: data.ConductorID,
            QuotaPolicyID: quotaPolicy.QuotaPolicyID,
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

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('CREATE_ASSIGNMENT_ERROR:', error);
    return NextResponse.json({ error: 'Failed to create BusAssignment' }, { status: 500 });
  }
}