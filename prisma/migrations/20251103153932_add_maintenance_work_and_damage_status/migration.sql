-- CreateEnum
CREATE TYPE "DamageReportStatus" AS ENUM ('Pending', 'Accepted', 'Rejected');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('Pending', 'InProgress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- AlterTable
ALTER TABLE "DamageReport" ADD COLUMN     "Status" "DamageReportStatus" NOT NULL DEFAULT 'Pending';

-- AlterTable
ALTER TABLE "Quota_Policy" ALTER COLUMN "EndDate" SET DEFAULT (CURRENT_TIMESTAMP + interval '1 year');

-- CreateTable
CREATE TABLE "MaintenanceWork" (
    "MaintenanceWorkID" TEXT NOT NULL,
    "DamageReportID" TEXT NOT NULL,
    "BusID" TEXT NOT NULL,
    "Status" "MaintenanceStatus" NOT NULL DEFAULT 'Pending',
    "Priority" "MaintenancePriority" NOT NULL DEFAULT 'Medium',
    "AssignedTo" TEXT,
    "ScheduledDate" TIMESTAMP(3),
    "CompletedDate" TIMESTAMP(3),
    "EstimatedCost" DOUBLE PRECISION,
    "ActualCost" DOUBLE PRECISION,
    "WorkNotes" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "MaintenanceWork_pkey" PRIMARY KEY ("MaintenanceWorkID")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWork_DamageReportID_key" ON "MaintenanceWork"("DamageReportID");

-- AddForeignKey
ALTER TABLE "MaintenanceWork" ADD CONSTRAINT "MaintenanceWork_DamageReportID_fkey" FOREIGN KEY ("DamageReportID") REFERENCES "DamageReport"("DamageReportID") ON DELETE CASCADE ON UPDATE CASCADE;
