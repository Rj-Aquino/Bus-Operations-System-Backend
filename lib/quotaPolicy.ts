import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';

function validateQuotaPolicy(type: string, value: number) {
  const normalizedType = type.toUpperCase();

  if (normalizedType !== 'FIXED' && normalizedType !== 'PERCENTAGE') {
    throw new Error("Invalid quota policy type. Must be 'FIXED' or 'PERCENTAGE'.");
  }

  if (normalizedType === 'FIXED') {
    if (typeof value !== 'number' || value < 0) {
      throw new Error('For FIXED quota policy, value must be a non-negative number.');
    }
  } else if (normalizedType === 'PERCENTAGE') {
    if (typeof value !== 'number' || value <= 0 || value > 1) {
      throw new Error('For PERCENTAGE quota policy, value must be a decimal between 0 (exclusive) and 1 (inclusive).');
    }
  }
}

export async function createQuotaPolicy({
  type,
  value,
  RegularBusAssignmentID,
}: {
  type: string;
  value: number;
  RegularBusAssignmentID: string; 
}) {
  validateQuotaPolicy(type, value);

  const QuotaPolicyID = await generateFormattedID('QP');
  const normalizedType = type.toUpperCase();

  return prisma.quota_Policy.create({
    data: {
      QuotaPolicyID,
      RegularBusAssignmentID, 
      ...(normalizedType === 'FIXED'
        ? {
            Fixed: {
              create: {
                FQuotaPolicyID: QuotaPolicyID,
                Quota: value,
              },
            },
          }
        : {
            Percentage: {
              create: {
                PQuotaPolicyID: QuotaPolicyID,
                Percentage: value,
              },
            },
          }),
    },
    select: {
      QuotaPolicyID: true,
    },
  });
}

export async function updateQuotaPolicy(
  QuotaPolicyID: string,
  data: { 
    type: string; 
    value: number; 
    StartDate?: string; 
    EndDate?: string; 
    RegularBusAssignmentID?: string 
  }
) {
  validateQuotaPolicy(data.type, data.value);
  const normalizedType = data.type.toUpperCase();

  await prisma.$transaction(async (tx) => {
    // Step 1: Update Quota_Policy dates and RegularBusAssignmentID
    await tx.quota_Policy.update({
      where: { QuotaPolicyID },
      data: {
        ...(data.StartDate && { StartDate: new Date(data.StartDate) }),
        ...(data.EndDate && { EndDate: new Date(data.EndDate) }),
        ...(data.RegularBusAssignmentID && { RegularBusAssignmentID: data.RegularBusAssignmentID }),
      },
    });

    // Step 2: Delete any existing Fixed or Percentage related to this QuotaPolicyID
    await Promise.all([
      tx.fixed.deleteMany({ where: { FQuotaPolicyID: QuotaPolicyID } }),
      tx.percentage.deleteMany({ where: { PQuotaPolicyID: QuotaPolicyID } }),
    ]);

    // Step 3: Create the new quota type entry (Fixed or Percentage)
    if (normalizedType === 'FIXED') {
      await tx.fixed.create({
        data: {
          FQuotaPolicyID: QuotaPolicyID,
          Quota: data.value,
        },
      });
    } else {
      await tx.percentage.create({
        data: {
          PQuotaPolicyID: QuotaPolicyID,
          Percentage: data.value,
        },
      });
    }
  });
}
