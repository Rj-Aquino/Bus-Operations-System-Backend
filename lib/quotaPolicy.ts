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
        ? { Fixed: { create: { Quota: value } } }
        : { Percentage: { create: { Percentage: value } } }),
    },
    select: {
      QuotaPolicyID: true,
    },
  });
}

export async function updateQuotaPolicy(
  QuotaPolicyID: string,
  data: { type: string; value: number; StartDate?: string; EndDate?: string }
) {
  validateQuotaPolicy(data.type, data.value);
  const normalizedType = data.type.toUpperCase();

  // Delete the old entry (assumes single type per policy)
  await prisma.$transaction([
    prisma.fixed.deleteMany({ where: { FQuotaPolicyID: QuotaPolicyID } }),
    prisma.percentage.deleteMany({ where: { PQuotaPolicyID: QuotaPolicyID } }),
  ]);

  // Insert the new one
  if (normalizedType === 'FIXED') {
    await prisma.fixed.create({
      data: {
        FQuotaPolicyID: QuotaPolicyID,
        Quota: data.value,
      },
    });
  } else {
    await prisma.percentage.create({
      data: {
        PQuotaPolicyID: QuotaPolicyID,
        Percentage: data.value,
      },
    });
  }
}
