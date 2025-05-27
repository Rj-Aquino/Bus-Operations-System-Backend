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

    return NextResponse.json(assignments);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const newQuotaPolicyID = await generateFormattedID('QP');

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

    return NextResponse.json(newQuotaPolicy, { status: 201 });

  } catch (error) {

    return NextResponse.json({ error: 'Failed to create quota policy' }, { status: 500 });
  }
}
