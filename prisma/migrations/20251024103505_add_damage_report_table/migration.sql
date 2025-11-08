-- AlterTable
ALTER TABLE "Quota_Policy" ALTER COLUMN "EndDate" SET DEFAULT (CURRENT_TIMESTAMP + interval '1 year');

-- CreateTable
CREATE TABLE "DamageReport" (
    "DamageReportID" TEXT NOT NULL,
    "RentalRequestID" TEXT NOT NULL,
    "RentalBusAssignmentID" TEXT NOT NULL,
    "Battery" BOOLEAN NOT NULL DEFAULT false,
    "Lights" BOOLEAN NOT NULL DEFAULT false,
    "Oil" BOOLEAN NOT NULL DEFAULT false,
    "Water" BOOLEAN NOT NULL DEFAULT false,
    "Brake" BOOLEAN NOT NULL DEFAULT false,
    "Air" BOOLEAN NOT NULL DEFAULT false,
    "Gas" BOOLEAN NOT NULL DEFAULT false,
    "Engine" BOOLEAN NOT NULL DEFAULT false,
    "TireCondition" BOOLEAN NOT NULL DEFAULT false,
    "Note" TEXT,
    "CheckDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "DamageReport_pkey" PRIMARY KEY ("DamageReportID")
);

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_RentalRequestID_fkey" FOREIGN KEY ("RentalRequestID") REFERENCES "RentalRequest"("RentalRequestID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_RentalBusAssignmentID_fkey" FOREIGN KEY ("RentalBusAssignmentID") REFERENCES "RentalBusAssignment"("RentalBusAssignmentID") ON DELETE CASCADE ON UPDATE CASCADE;
