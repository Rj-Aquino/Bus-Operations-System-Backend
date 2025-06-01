import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const putHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const QuotaPolicyID = url.pathname.split('/').pop();
    const { type, value, RegularBusAssignmentID } = await request.json();

    if (!QuotaPolicyID) {
      return NextResponse.json({ error: 'QuotaPolicyID is required in the URL path.' }, { status: 400 });
    }

    const numericValue = parseFloat(value);
    const normalizedType = type?.toLowerCase();

    if (!['fixed', 'percentage'].includes(normalizedType) || isNaN(numericValue)) {
      return NextResponse.json({
        error: 'Invalid type or value. Type must be "Fixed" or "Percentage", and value must be a number.',
      }, { status: 400 });
    }

    const exists = await prisma.quota_Policy.findUnique({
      where: { QuotaPolicyID },
      select: { QuotaPolicyID: true },
    });

    if (!exists) {
      return NextResponse.json({ error: 'Quota policy not found.' }, { status: 404 });
    }

    const updatedQuotaPolicy = await prisma.$transaction(async (tx) => {
      if (RegularBusAssignmentID) {
        await tx.quota_Policy.update({
          where: { QuotaPolicyID },
          data: { RegularBusAssignmentID },
        });
      }

      if (normalizedType === 'fixed') {
        await tx.percentage.deleteMany({ where: { PQuotaPolicyID: QuotaPolicyID } });
        await tx.fixed.upsert({
          where: { FQuotaPolicyID: QuotaPolicyID },
          update: { Quota: numericValue },
          create: { FQuotaPolicyID: QuotaPolicyID, Quota: numericValue },
        });
      } else {
        await tx.fixed.deleteMany({ where: { FQuotaPolicyID: QuotaPolicyID } });
        await tx.percentage.upsert({
          where: { PQuotaPolicyID: QuotaPolicyID },
          update: { Percentage: numericValue / 100 },
          create: { PQuotaPolicyID: QuotaPolicyID, Percentage: numericValue / 100 },
        });
      }

      return tx.quota_Policy.findUnique({
        where: { QuotaPolicyID },
        select: {
          QuotaPolicyID: true,
          StartDate: true,
          EndDate: true,
          RegularBusAssignmentID: true,
          Fixed: { select: { Quota: true } },
          Percentage: { select: { Percentage: true } },
        },
      });
    });

    return NextResponse.json(updatedQuotaPolicy, { status: 200 });

  } catch (error) {
    console.error('PUT /quota-policy error:', error);
    return NextResponse.json({ error: 'Failed to update quota policy' }, { status: 500 });
  }
};

export const PUT = withCors(putHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
