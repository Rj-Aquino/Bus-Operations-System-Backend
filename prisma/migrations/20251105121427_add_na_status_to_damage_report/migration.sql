-- AlterEnum
ALTER TYPE "DamageReportStatus" ADD VALUE 'NA';

-- Commit the transaction to make the new enum value available
COMMIT;

-- Start a new transaction for the rest
BEGIN;

-- AlterTable
ALTER TABLE "DamageReport" ALTER COLUMN "Status" SET DEFAULT 'NA';

-- AlterTable
ALTER TABLE "Quota_Policy" ALTER COLUMN "EndDate" SET DEFAULT (CURRENT_TIMESTAMP + interval '1 year');
