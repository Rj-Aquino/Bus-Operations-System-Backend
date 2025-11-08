import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillWorkNo() {
  try {
    console.log('Starting WorkNo backfill...');

    // Get all MaintenanceWork records without WorkNo, ordered by CreatedAt
    const maintenanceWorks = await prisma.maintenanceWork.findMany({
      where: {
        WorkNo: null
      },
      orderBy: {
        CreatedAt: 'asc'
      }
    });

    console.log(`Found ${maintenanceWorks.length} records to backfill`);

    if (maintenanceWorks.length === 0) {
      console.log('No records to backfill. All done!');
      return;
    }

    // Update each record with sequential WorkNo
    let counter = 1;
    for (const work of maintenanceWorks) {
      const workNo = `WRK-${String(counter).padStart(5, '0')}`;
      
      await prisma.maintenanceWork.update({
        where: {
          MaintenanceWorkID: work.MaintenanceWorkID
        },
        data: {
          WorkNo: workNo
        }
      });

      console.log(`Updated ${work.MaintenanceWorkID} with WorkNo: ${workNo}`);
      counter++;
    }

    console.log(`✅ Successfully backfilled ${maintenanceWorks.length} records`);
  } catch (error) {
    console.error('Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillWorkNo()
  .then(() => {
    console.log('Backfill completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
