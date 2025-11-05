-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('Pending', 'InProgress', 'Completed');

-- CreateTable
CREATE TABLE "Task" (
    "TaskID" TEXT NOT NULL,
    "MaintenanceWorkID" TEXT NOT NULL,
    "TaskNumber" TEXT,
    "TaskName" TEXT NOT NULL,
    "TaskType" TEXT,
    "TaskDescription" TEXT,
    "AssignedTo" TEXT,
    "Status" "TaskStatus" NOT NULL DEFAULT 'Pending',
    "Priority" TEXT,
    "StartDate" TIMESTAMP(3),
    "CompletedDate" TIMESTAMP(3),
    "EstimatedHours" DOUBLE PRECISION,
    "ActualHours" DOUBLE PRECISION,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("TaskID")
);

-- CreateIndex
CREATE INDEX "Task_MaintenanceWorkID_idx" ON "Task"("MaintenanceWorkID");

-- CreateIndex
CREATE INDEX "Task_Status_idx" ON "Task"("Status");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_MaintenanceWorkID_fkey" FOREIGN KEY ("MaintenanceWorkID") REFERENCES "MaintenanceWork"("MaintenanceWorkID") ON DELETE CASCADE ON UPDATE CASCADE;
