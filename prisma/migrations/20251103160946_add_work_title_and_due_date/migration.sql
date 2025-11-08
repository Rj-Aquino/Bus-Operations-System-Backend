-- AlterTable
ALTER TABLE "MaintenanceWork" ADD COLUMN     "DueDate" TIMESTAMP(3),
ADD COLUMN     "WorkTitle" TEXT;

-- AlterTable
ALTER TABLE "Quota_Policy" ALTER COLUMN "EndDate" SET DEFAULT (CURRENT_TIMESTAMP + interval '1 year');
