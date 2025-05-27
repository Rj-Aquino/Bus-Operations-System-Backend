import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database
import { generateFormattedID } from '../../../lib/idGenerator';

export async function GET() {
  try {
    const assignments = await prisma.quota_Policy.findMany({
      select: {
        QuotaPolicyID: true,
        StartDate: true,
        EndDate: true,
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
        RegularBusAssignments: {
          select: {
            RegularBusAssignmentID: true,
          },
        },
      },
    });

    return NextResponse.json(assignments, { status: 200 });
  } catch (error) {
    console.error('GET /quota-policy error:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { type, value } = data;

    if (!['Fixed', 'Percentage'].includes(type) || isNaN(parseFloat(value))) {
      return NextResponse.json(
        { error: 'Invalid type or value. Type must be "Fixed" or "Percentage", and value must be a number.' },
        { status: 400 }
      );
    }

    const newQuotaPolicyID = await generateFormattedID('QP');

    const newQuotaPolicy = await prisma.quota_Policy.create({
      data: {
        QuotaPolicyID: newQuotaPolicyID,
        StartDate: new Date(),
        EndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        ...(type === 'Fixed'
          ? { Fixed: { create: { Quota: parseFloat(value) } } }
          : { Percentage: { create: { Percentage: parseFloat(value) / 100 } } }),
      },
      select: {
        QuotaPolicyID: true,
        StartDate: true,
        EndDate: true,
        Fixed: { select: { Quota: true } },
        Percentage: { select: { Percentage: true } },
        RegularBusAssignments: { select: { RegularBusAssignmentID: true } },
      }
    });

    return NextResponse.json(newQuotaPolicy, { status: 201 });

  } catch (error) {
    console.error('POST /quota-policy error:', error);
    return NextResponse.json({ error: 'Failed to create quota policy' }, { status: 500 });
  }
}
