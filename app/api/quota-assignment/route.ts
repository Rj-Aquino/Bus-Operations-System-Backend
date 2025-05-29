import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

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
      },
    });

    return NextResponse.json(assignments, { status: 200 });
  } catch (error) {
    console.error('GET /quota-policy error:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
};

const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const data = await request.json();
    const { type, value } = data;

    const normalizedType = type?.toLowerCase();
    const numericValue = parseFloat(value);

    if (
      !['fixed', 'percentage'].includes(normalizedType) ||
      isNaN(numericValue)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid input. Type must be "Fixed" or "Percentage", and value must be a valid number.',
        },
        { status: 400 }
      );
    }

    const newQuotaPolicyID = await generateFormattedID('QP');

    const newQuotaPolicy = await prisma.quota_Policy.create({
      data: {
        QuotaPolicyID: newQuotaPolicyID,
        ...(normalizedType === 'fixed'
          ? { Fixed: { create: { Quota: numericValue } } }
          : { Percentage: { create: { Percentage: numericValue / 100 } } }),
      },
      select: {
        QuotaPolicyID: true,
        Fixed: { select: { Quota: true } },
        Percentage: { select: { Percentage: true } },
        RegularBusAssignments: { select: { RegularBusAssignmentID: true } },
      },
    });

    return NextResponse.json(newQuotaPolicy, { status: 201 });
  } catch (error) {
    console.error('POST /quota-policy error:', error);
    return NextResponse.json({ error: 'Failed to create quota policy' }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
