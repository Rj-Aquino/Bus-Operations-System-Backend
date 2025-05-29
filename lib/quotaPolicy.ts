import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';

export async function createQuotaPolicy({ type, value }: { type: string; value: number }) {
  const QuotaPolicyID = await generateFormattedID('QP');
  const normalizedType = type.toUpperCase();

  return prisma.quota_Policy.create({
    data: {
      QuotaPolicyID,
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
