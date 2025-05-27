import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/client'; // Importing the Prisma client instance to interact with the database

export async function PUT(request: NextRequest) {
  try {
    // Extract QuotaPolicyID from URL path
    const url = new URL(request.url);
    const QuotaPolicyID = url.pathname.split('/').pop();
    const data = await request.json();

    // Validate input fields
    if (!QuotaPolicyID) {
      return NextResponse.json({ error: 'QuotaPolicyID is required in the URL path' }, { status: 400 });
    }

    if (!data.type || (data.type !== 'Fixed' && data.type !== 'Percentage')) {
      return NextResponse.json({ error: 'Valid type (Fixed or Percentage) is required' }, { status: 400 });
    }

    const existingQuotaPolicy = await prisma.quota_Policy.findUnique({
      where: { QuotaPolicyID },
      include: {
        Fixed: true,
        Percentage: true,
      },
    });

    if (!existingQuotaPolicy) {
      return NextResponse.json({ error: 'QuotaPolicy not found' }, { status: 404 });
    }

    const isFixed = data.type === 'Fixed';
    const newValue = parseFloat(data.value);

    const updateData: {
      StartDate?: Date;
      EndDate?: Date;
      Fixed?: { update: { Quota: number } } | { create: { Quota: number } };
      Percentage?: { update: { Percentage: number } } | { create: { Percentage: number } };
    } = {};

    if (isFixed) {
      if (existingQuotaPolicy.Percentage) {
        await prisma.percentage.delete({
          where: { PQuotaPolicyID: QuotaPolicyID },
        });
      }

      updateData.Fixed = existingQuotaPolicy.Fixed
        ? { update: { Quota: newValue } }
        : { create: { Quota: newValue } };
    } else {
      if (existingQuotaPolicy.Fixed) {
        await prisma.fixed.delete({
          where: { FQuotaPolicyID: QuotaPolicyID },
        });
      }

      updateData.Percentage = existingQuotaPolicy.Percentage
        ? { update: { Percentage: newValue / 100 } }
        : { create: { Percentage: newValue / 100 } };
    }

    const updatedQuotaPolicy = await prisma.quota_Policy.update({
      where: { QuotaPolicyID },
      data: updateData,
      include: {
        Fixed: { select: { Quota: true } },
        Percentage: { select: { Percentage: true } },
        RegularBusAssignments: { select: { RegularBusAssignmentID: true } },
      },
    });

    return NextResponse.json(updatedQuotaPolicy, { status: 200 });

  } catch (error) {
    console.error('Error updating quota policy:', error);
    return NextResponse.json({ error: 'Failed to update quota policy' }, { status: 500 });
  }
}