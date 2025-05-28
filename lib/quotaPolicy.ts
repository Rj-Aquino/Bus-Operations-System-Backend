import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';

export async function createQuotaPolicy({ type, value }: { type: 'FIXED' | 'PERCENTAGE'; value: number }) {
  const QuotaPolicyID = await generateFormattedID('QP');

  return prisma.quota_Policy.create({
    data: {
      QuotaPolicyID,
      ...(type === 'FIXED'
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
  data: { type: 'FIXED' | 'PERCENTAGE'; value: number; StartDate?: string; EndDate?: string }
) {
  // Delete the old entry (assumes single type per policy)
  await prisma.$transaction([
    prisma.fixed.deleteMany({ where: { FQuotaPolicyID: QuotaPolicyID } }),
    prisma.percentage.deleteMany({ where: { PQuotaPolicyID: QuotaPolicyID } }),
  ]);

  // Insert the new one
  if (data.type === 'FIXED') {
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
