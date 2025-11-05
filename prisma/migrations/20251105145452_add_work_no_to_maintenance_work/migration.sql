/*
  Warnings:

  - A unique constraint covering the columns `[WorkNo]` on the table `MaintenanceWork` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MaintenanceWork" ADD COLUMN     "WorkNo" TEXT;

-- AlterTable
ALTER TABLE "Quota_Policy" ALTER COLUMN "EndDate" SET DEFAULT (CURRENT_TIMESTAMP + interval '1 year');

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWork_WorkNo_key" ON "MaintenanceWork"("WorkNo");
