const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Update the quota policy to start from Jan 1, 2026
  const updated = await prisma.quota_Policy.update({
    where: { QuotaPolicyID: 'QP-oyj1vyhf2d3phy7tj9ysgnq9' },
    data: {
      StartDate: new Date('2026-01-01T00:00:00.000Z')
    }
  });
  
  console.log('Updated Quota Policy:', JSON.stringify(updated, null, 2));
}

main().finally(() => prisma.$disconnect());
