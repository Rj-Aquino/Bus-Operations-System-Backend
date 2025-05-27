import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database
import { generateFormattedID } from '../../../lib/idGenerator';

export async function GET() {
  try {
    const assignments = await prisma.quota_Policy.findMany({
        include: {
            Fixed: {
                select: {
                    Quota: true,
                }
            },
            Percentage: {
                select: {
                    Percentage: true,
                }
            },
            RegularBusAssignments: {
                select: {
                    RegularBusAssignmentID: true,
                }
            },
        }
    });
    console.log('Assignments from database:', assignments); // Debugging

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching bus route assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('Data received in API:', data); // Debugging

    // Step 1: Generate a formatted QuotaPolicyID
    console.log('Generating new QuotaPolicyID...'); // Debugging
    const newQuotaPolicyID = await generateFormattedID('QP');
    console.log('Generated new QuotaPolicyID:', newQuotaPolicyID); // Debugging

    // Step 2: Create the new QuotaPolicy
    console.log('Creating new QuotaPolicy...'); // Debugging
    const newQuotaPolicy = await prisma.quota_Policy.create({
      data: {
        QuotaPolicyID: newQuotaPolicyID,
        StartDate: new Date(),
        EndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        ...(data.type === 'Fixed'
          ? { Fixed: { create: { Quota: parseFloat(data.value) } } }
          : { Percentage: { create: { Percentage: parseFloat(data.value) / 100 } } }),
      },
      include: {
        Fixed: {
          select: { Quota: true },
        },
        Percentage: {
          select: { Percentage: true },
        },
        RegularBusAssignments: {
          select: { RegularBusAssignmentID: true },
        },
      }
    });

    console.log('New QuotaPolicy created:', newQuotaPolicy); // Debugging
    return NextResponse.json(newQuotaPolicy, { status: 201 });

  } catch (error) {
    console.error('Error creating quota policy:', error);
    return NextResponse.json({ error: 'Failed to create quota policy' }, { status: 500 });
  }
}
