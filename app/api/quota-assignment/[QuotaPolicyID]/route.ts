import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database

export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const QuotaPolicyID = url.pathname.split('/').pop();
    const { type, value } = await request.json();

    // Validate basic input
    if (!QuotaPolicyID) {
      return NextResponse.json({ error: 'QuotaPolicyID is required in the URL path.' }, { status: 400 });
    }

    const numericValue = parseFloat(value);
    if (!type || (type !== 'Fixed' && type !== 'Percentage') || isNaN(numericValue)) {
      return NextResponse.json({ error: 'Invalid type or value. Type must be "Fixed" or "Percentage", and value must be a number.' }, { status: 400 });
    }

    const existingQuotaPolicy = await prisma.quota_Policy.findUnique({
      where: { QuotaPolicyID },
      include: { Fixed: true, Percentage: true },
    });

    if (!existingQuotaPolicy) {
      return NextResponse.json({ error: 'Quota policy not found.' }, { status: 404 });
    }

    // Start transaction
    const updatedQuotaPolicy = await prisma.$transaction(async (tx) => {
      if (type === 'Fixed') {
        if (existingQuotaPolicy.Percentage) {
          await tx.percentage.delete({ where: { PQuotaPolicyID: QuotaPolicyID } });
        }

        if (existingQuotaPolicy.Fixed) {
          await tx.fixed.update({
            where: { FQuotaPolicyID: QuotaPolicyID },
            data: { Quota: numericValue },
          });
        } else {
          await tx.fixed.create({
            data: {
              FQuotaPolicyID: QuotaPolicyID,
              Quota: numericValue,
            },
          });
        }
      } else {
        if (existingQuotaPolicy.Fixed) {
          await tx.fixed.delete({ where: { FQuotaPolicyID: QuotaPolicyID } });
        }

        if (existingQuotaPolicy.Percentage) {
          await tx.percentage.update({
            where: { PQuotaPolicyID: QuotaPolicyID },
            data: { Percentage: numericValue / 100 },
          });
        } else {
          await tx.percentage.create({
            data: {
              PQuotaPolicyID: QuotaPolicyID,
              Percentage: numericValue / 100,
            },
          });
        }
      }

      return tx.quota_Policy.findUnique({
        where: { QuotaPolicyID },
        select: {
          QuotaPolicyID: true,
          StartDate: true,
          EndDate: true,
          Fixed: { select: { Quota: true } },
          Percentage: { select: { Percentage: true } },
          RegularBusAssignments: { select: { RegularBusAssignmentID: true } },
        },
      });
    });

    return NextResponse.json(updatedQuotaPolicy, { status: 200 });
  } catch (error) {
    console.error('PUT /quota-policy error:', error);
    return NextResponse.json({ error: 'Failed to update quota policy' }, { status: 500 });
  }
}
