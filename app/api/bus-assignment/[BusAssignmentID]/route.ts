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

    // Step 1: Soft delete if IsDeleted is true
    if (data.IsDeleted === true) {
      const updatedBusAssignment = await prisma.busAssignment.update({
        where: { BusAssignmentID },
        data: { IsDeleted: true },
      });

      return NextResponse.json(updatedBusAssignment, { status: 200 });
    }

    // Step 2: Fetch the existing BusAssignment with RegularBusAssignment
    const existingBusAssignment = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID },
      include: {
        RegularBusAssignment: {
          include: {
            quotaPolicy: true,
          },
        },
      },
    });

    if (!existingBusAssignment || !existingBusAssignment.RegularBusAssignment) {
      return NextResponse.json({ error: 'BusAssignment or RegularBusAssignment not found' }, { status: 404 });
    }

    const baseUrl = process.env.APPLICATION_URL;
    if (!baseUrl) {
      return NextResponse.json({ error: 'Base URL is not defined' }, { status: 500 });
    }

    // Step 3: Conditionally update QuotaPolicy via API if needed
    const quotaPolicyId = existingBusAssignment.RegularBusAssignment.quotaPolicy?.QuotaPolicyID;
    const shouldUpdateQuotaPolicy = data.type && data.value && quotaPolicyId;

    if (shouldUpdateQuotaPolicy) {
      const quotaPolicyData = {
        QuotaPolicyID: quotaPolicyId,
        type: data.type,
        value: data.value,
        StartDate: data.StartDate,
        EndDate: data.EndDate,
      };

      const quotaPolicyResponse = await fetch(`${baseUrl}/api/quota-assignment/${quotaPolicyData.QuotaPolicyID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: quotaPolicyData.type,
          value: quotaPolicyData.value,
          StartDate: quotaPolicyData.StartDate,
          EndDate: quotaPolicyData.EndDate,
        }),
      });

      const quotaPolicyResponseData = await quotaPolicyResponse.json();

      if (!quotaPolicyResponse.ok) {
        return NextResponse.json(
          { error: quotaPolicyResponseData.error || 'Failed to update QuotaPolicy' },
          { status: 500 }
        );
      }
    }

    // Step 4: Update the BusAssignment and related RegularBusAssignment
    const updatedBusAssignment = await prisma.busAssignment.update({
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

    return NextResponse.json(updatedBusAssignment, { status: 200 });

  } catch (error) {
    console.error('Error updating bus assignment:', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const url = new URL(req.url);
    const BusAssignmentID = url.pathname.split('/').pop();
    const { isDeleted } = await req.json();

    if (!BusAssignmentID) {
      return NextResponse.json({ error: 'busAssignmentID is required' }, { status: 400 });
    }

    const updatedAssignment = await prisma.busAssignment.update({
      where: { BusAssignmentID: BusAssignmentID },
      data: { IsDeleted: isDeleted },
    });

    return NextResponse.json(updatedAssignment, { status: 200 });
  } catch (error) {
    console.error('Error updating bus assignment:', error);
    return NextResponse.json({ error: 'Failed to update bus assignment' }, { status: 500 });
  }
}