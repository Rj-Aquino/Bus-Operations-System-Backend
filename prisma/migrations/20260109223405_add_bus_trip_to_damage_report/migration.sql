-- AlterTable
ALTER TABLE "DamageReport" ADD COLUMN     "BusTripID" TEXT,
ALTER COLUMN "RentalRequestID" DROP NOT NULL,
ALTER COLUMN "RentalBusAssignmentID" DROP NOT NULL,
ALTER COLUMN "Status" SET DEFAULT 'NA';

-- AlterTable
ALTER TABLE "Quota_Policy" ALTER COLUMN "EndDate" SET DEFAULT (CURRENT_TIMESTAMP + interval '1 year');

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_BusTripID_fkey" FOREIGN KEY ("BusTripID") REFERENCES "BusTrip"("BusTripID") ON DELETE CASCADE ON UPDATE CASCADE;
