import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database
import { generateFormattedID } from '../../../lib/idGenerator';

export async function GET() {
  try {
    // Fetching bus assignments where IsDeleted is false
    const assignments = await prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: {
          IsDeleted: false,  // Only fetch rows where IsDeleted is false
        },
      },
      include: {
        BusAssignment: {
          include: {
            Route: true,  // Include related Route information
          },
        },
        quotaPolicy: {
          select: {
            QuotaPolicyID : true,
            Fixed: true,  // Include Fixed quota
            Percentage: true,  // Include Percentage quota
          },
        },
      },
    });

    return NextResponse.json(assignments);  // Return fetched assignments
  } catch (error) {
    console.error('Error fetching bus route assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('POST request received'); // Debugging

    const data = await request.json();
    console.log('Data received in API:', data); // Debugging

    const baseUrl = process.env.APPLICATION_URL;

    // === Validate Required Fields (excluding AssignmentDate) ===
    const requiredFields = [
      'BusID',
      'RouteID',
      'DriverID',
      'ConductorID',
      'QuotaPolicy',
    ];

    for (const field of requiredFields) {
      if (
        !data[field] ||
        (typeof data[field] === 'string' && data[field].trim() === '') ||
        (field === 'QuotaPolicy' &&
          (!data.QuotaPolicy.type || !data.QuotaPolicy.value))
      ) {
        return NextResponse.json(
          { error: `Missing or empty required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Extract the numeric part after the hyphen from DriverID and ConductorID
    const driverSuffix = data.DriverID.split('-')[1];
    const conductorSuffix = data.ConductorID.split('-')[1];

    // Validate that driver and conductor suffix are not the same
    if (driverSuffix === conductorSuffix) {
      return NextResponse.json(
        { error: 'Driver and Conductor cannot be the same person' },
        { status: 400 }
      );
    }

    // Step 1: Call API to create QuotaPolicy
    console.log('Calling QuotaPolicy API...');
    const quotaPolicyResponse = await fetch(`${baseUrl}/api/quota-assignment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: data.QuotaPolicy.type,
        value: data.QuotaPolicy.value,
      }),
    });

    if (!quotaPolicyResponse.ok) {
      throw new Error('Failed to create QuotaPolicy from API');
    }

    const newQuotaPolicy = await quotaPolicyResponse.json();
    console.log('QuotaPolicy created via API:', newQuotaPolicy);

    // Step 2: Generate BusAssignmentID
    console.log('Generating new BusAssignmentID...');
    const newBusAssignmentID = await generateFormattedID('BA');
    console.log('Generated new BusAssignmentID:', newBusAssignmentID);

    // Step 3: Create the BusAssignment with RegularBusAssignment
    console.log('Creating new BusAssignment record...');
    const newAssignment = await prisma.busAssignment.create({
      data: {
        BusAssignmentID: newBusAssignmentID,
        BusID: data.BusID,
        RouteID: data.RouteID,
        AssignmentDate: data.AssignmentDate ? new Date(data.AssignmentDate) : new Date(), // default to today if not provided
        RegularBusAssignment: {
          create: {
            DriverID: data.DriverID,
            ConductorID: data.ConductorID,
            QuotaPolicyID: newQuotaPolicy.QuotaPolicyID,
            Change: data.Change,
            TripRevenue: data.TripRevenue,
          },
        },
      },
      include: {
        RegularBusAssignment: {
          include: {
            quotaPolicy: {
              include: {
                Fixed: true,
                Percentage: true,
              },
            },
          },
        },
      },
    });

    console.log('New BusAssignment created in database:', newAssignment);
    return NextResponse.json(newAssignment, { status: 201 });

  } catch (error) {
    console.error('Error creating BusAssignment:', error);
    return NextResponse.json(
      { error: 'Failed to create BusAssignment' },
      { status: 500 }
    );
  }
}
