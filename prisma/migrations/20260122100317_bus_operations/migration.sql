-- CreateEnum
CREATE TYPE "BusOperationStatus" AS ENUM ('NotStarted', 'NotReady', 'InOperation');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('Regular', 'Rental');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Reimbursement', 'Company_Cash');

-- CreateEnum
CREATE TYPE "RentalRequestStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Completed');

-- CreateEnum
CREATE TYPE "DamageReportStatus" AS ENUM ('NA', 'Pending', 'Accepted', 'Rejected');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('Pending', 'InProgress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('Pending', 'InProgress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('Inspection', 'Repair', 'Replacement', 'Cleaning', 'Testing', 'Documentation', 'Other');

-- CreateEnum
CREATE TYPE "ToolSourceType" AS ENUM ('FromInventory', 'PurchasedExternally');

-- CreateTable
CREATE TABLE "Quota_Policy" (
    "QuotaPolicyID" TEXT NOT NULL,
    "StartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "EndDate" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '1 year'),
    "RegularBusAssignmentID" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "Quota_Policy_pkey" PRIMARY KEY ("QuotaPolicyID")
);

-- CreateTable
CREATE TABLE "Fixed" (
    "FQuotaPolicyID" TEXT NOT NULL,
    "Quota" DOUBLE PRECISION NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "Fixed_pkey" PRIMARY KEY ("FQuotaPolicyID")
);

-- CreateTable
CREATE TABLE "Percentage" (
    "PQuotaPolicyID" TEXT NOT NULL,
    "Percentage" DOUBLE PRECISION NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "Percentage_pkey" PRIMARY KEY ("PQuotaPolicyID")
);

-- CreateTable
CREATE TABLE "Stop" (
    "StopID" TEXT NOT NULL,
    "StopName" TEXT NOT NULL,
    "latitude" TEXT NOT NULL,
    "longitude" TEXT NOT NULL,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("StopID")
);

-- CreateTable
CREATE TABLE "Route" (
    "RouteID" TEXT NOT NULL,
    "StartStopID" TEXT NOT NULL,
    "EndStopID" TEXT NOT NULL,
    "RouteName" TEXT NOT NULL,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("RouteID")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "RouteStopID" TEXT NOT NULL,
    "RouteID" TEXT NOT NULL,
    "StopID" TEXT NOT NULL,
    "StopOrder" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("RouteStopID")
);

-- CreateTable
CREATE TABLE "BusAssignment" (
    "BusAssignmentID" TEXT NOT NULL,
    "BusID" TEXT NOT NULL,
    "RouteID" TEXT,
    "AssignmentType" "AssignmentType" NOT NULL DEFAULT 'Regular',
    "Battery" BOOLEAN NOT NULL DEFAULT false,
    "Lights" BOOLEAN NOT NULL DEFAULT false,
    "Oil" BOOLEAN NOT NULL DEFAULT false,
    "Water" BOOLEAN NOT NULL DEFAULT false,
    "Brake" BOOLEAN NOT NULL DEFAULT false,
    "Air" BOOLEAN NOT NULL DEFAULT false,
    "Gas" BOOLEAN NOT NULL DEFAULT false,
    "Engine" BOOLEAN NOT NULL DEFAULT false,
    "TireCondition" BOOLEAN NOT NULL DEFAULT false,
    "Self_Driver" BOOLEAN NOT NULL DEFAULT false,
    "Self_Conductor" BOOLEAN NOT NULL DEFAULT false,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "Status" "BusOperationStatus" NOT NULL DEFAULT 'NotReady',
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "BusAssignment_pkey" PRIMARY KEY ("BusAssignmentID")
);

-- CreateTable
CREATE TABLE "RegularBusAssignment" (
    "RegularBusAssignmentID" TEXT NOT NULL,
    "DriverID" TEXT NOT NULL,
    "ConductorID" TEXT NOT NULL,
    "LatestBusTripID" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "RegularBusAssignment_pkey" PRIMARY KEY ("RegularBusAssignmentID")
);

-- CreateTable
CREATE TABLE "BusTrip" (
    "BusTripID" TEXT NOT NULL,
    "RegularBusAssignmentID" TEXT NOT NULL,
    "DispatchedAt" TIMESTAMP(3),
    "CompletedAt" TIMESTAMP(3),
    "Sales" DOUBLE PRECISION,
    "PettyCash" DOUBLE PRECISION,
    "Remarks" TEXT,
    "TripExpense" DOUBLE PRECISION,
    "Payment_Method" "PaymentMethod",
    "IsRevenueRecorded" BOOLEAN NOT NULL DEFAULT false,
    "IsExpenseRecorded" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "BusTrip_pkey" PRIMARY KEY ("BusTripID")
);

-- CreateTable
CREATE TABLE "Ticket_Type" (
    "TicketTypeID" TEXT NOT NULL,
    "Value" DOUBLE PRECISION NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "Ticket_Type_pkey" PRIMARY KEY ("TicketTypeID")
);

-- CreateTable
CREATE TABLE "TicketBusTripAssignment" (
    "TicketBusTripID" TEXT NOT NULL,
    "BusTripID" TEXT NOT NULL,
    "TicketTypeID" TEXT NOT NULL,
    "StartingIDNumber" INTEGER,
    "EndingIDNumber" INTEGER,
    "OverallEndingID" INTEGER,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "TicketBusTripAssignment_pkey" PRIMARY KEY ("TicketBusTripID")
);

-- CreateTable
CREATE TABLE "RentalBusAssignment" (
    "RentalBusAssignmentID" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "RentalBusAssignment_pkey" PRIMARY KEY ("RentalBusAssignmentID")
);

-- CreateTable
CREATE TABLE "RentalDriver" (
    "RentalDriverID" TEXT NOT NULL,
    "RentalBusAssignmentID" TEXT NOT NULL,
    "DriverID" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "RentalDriver_pkey" PRIMARY KEY ("RentalDriverID")
);

-- CreateTable
CREATE TABLE "RentalRequest" (
    "RentalRequestID" TEXT NOT NULL,
    "RentalBusAssignmentID" TEXT,
    "RouteName" TEXT NOT NULL,
    "Pickuplatitude" TEXT NOT NULL,
    "Pickuplongitude" TEXT NOT NULL,
    "Dropofflatitude" TEXT NOT NULL,
    "Dropofflongitude" TEXT NOT NULL,
    "DistanceKM" DOUBLE PRECISION NOT NULL,
    "NumberOfPassengers" INTEGER NOT NULL,
    "RentalDate" TIMESTAMP(3) NOT NULL,
    "Duration" INTEGER NOT NULL,
    "SpecialRequirements" TEXT,
    "Status" "RentalRequestStatus" NOT NULL DEFAULT 'Pending',
    "AutoRejectReason" TEXT,
    "CustomerName" TEXT NOT NULL,
    "CustomerContact" TEXT NOT NULL,
    "CustomerEmail" TEXT NOT NULL,
    "IDType" TEXT NOT NULL,
    "IDNumber" TEXT NOT NULL,
    "HomeAddress" TEXT NOT NULL,
    "IDImage" TEXT NOT NULL,
    "TotalRentalAmount" DOUBLE PRECISION NOT NULL,
    "DownPaymentAmount" DOUBLE PRECISION,
    "BalanceAmount" DOUBLE PRECISION,
    "DownPaymentDate" TIMESTAMP(3),
    "FullPaymentDate" TIMESTAMP(3),
    "CancelledAtDate" TIMESTAMP(3),
    "CancelledReason" TEXT,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "RentalRequest_pkey" PRIMARY KEY ("RentalRequestID")
);

-- CreateTable
CREATE TABLE "DamageReport" (
    "DamageReportID" TEXT NOT NULL,
    "BusAssignmentID" TEXT NOT NULL,
    "BusTripID" TEXT,
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
    "Status" "DamageReportStatus" NOT NULL DEFAULT 'NA',
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "DamageReport_pkey" PRIMARY KEY ("DamageReportID")
);

-- CreateTable
CREATE TABLE "MaintenanceWork" (
    "MaintenanceWorkID" TEXT NOT NULL,
    "DamageReportID" TEXT NOT NULL,
    "Status" "MaintenanceStatus" NOT NULL DEFAULT 'Pending',
    "Priority" "MaintenancePriority" NOT NULL DEFAULT 'Medium',
    "WorkTitle" TEXT,
    "ScheduledDate" TIMESTAMP(3),
    "DueDate" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "Task" (
    "TaskID" TEXT NOT NULL,
    "MaintenanceWorkID" TEXT NOT NULL,
    "TaskName" TEXT NOT NULL,
    "TaskType" "TaskType" NOT NULL,
    "TaskDescription" TEXT,
    "AssignedTo" TEXT,
    "Status" "TaskStatus" NOT NULL DEFAULT 'Pending',
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

-- CreateTable
CREATE TABLE "TaskTool" (
    "TaskToolID" TEXT NOT NULL,
    "TaskID" TEXT NOT NULL,
    "ToolID" TEXT,
    "QuantityUsed" DOUBLE PRECISION NOT NULL,
    "Unit" TEXT NOT NULL,
    "SourceType" "ToolSourceType" NOT NULL DEFAULT 'FromInventory',
    "CostPerUnit" DOUBLE PRECISION,
    "TotalCost" DOUBLE PRECISION,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT,

    CONSTRAINT "TaskTool_pkey" PRIMARY KEY ("TaskToolID")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_RouteID_StopID_key" ON "RouteStop"("RouteID", "StopID");

-- CreateIndex
CREATE INDEX "BusAssignment_BusID_idx" ON "BusAssignment"("BusID");

-- CreateIndex
CREATE UNIQUE INDEX "RegularBusAssignment_LatestBusTripID_key" ON "RegularBusAssignment"("LatestBusTripID");

-- CreateIndex
CREATE INDEX "RegularBusAssignment_DriverID_idx" ON "RegularBusAssignment"("DriverID");

-- CreateIndex
CREATE INDEX "RegularBusAssignment_ConductorID_idx" ON "RegularBusAssignment"("ConductorID");

-- CreateIndex
CREATE UNIQUE INDEX "RentalDriver_RentalBusAssignmentID_DriverID_key" ON "RentalDriver"("RentalBusAssignmentID", "DriverID");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWork_DamageReportID_key" ON "MaintenanceWork"("DamageReportID");

-- CreateIndex
CREATE INDEX "Task_MaintenanceWorkID_idx" ON "Task"("MaintenanceWorkID");

-- CreateIndex
CREATE INDEX "Task_Status_idx" ON "Task"("Status");

-- CreateIndex
CREATE INDEX "TaskTool_TaskID_idx" ON "TaskTool"("TaskID");

-- CreateIndex
CREATE INDEX "TaskTool_ToolID_idx" ON "TaskTool"("ToolID");

-- AddForeignKey
ALTER TABLE "Quota_Policy" ADD CONSTRAINT "Quota_Policy_RegularBusAssignmentID_fkey" FOREIGN KEY ("RegularBusAssignmentID") REFERENCES "RegularBusAssignment"("RegularBusAssignmentID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixed" ADD CONSTRAINT "Fixed_FQuotaPolicyID_fkey" FOREIGN KEY ("FQuotaPolicyID") REFERENCES "Quota_Policy"("QuotaPolicyID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Percentage" ADD CONSTRAINT "Percentage_PQuotaPolicyID_fkey" FOREIGN KEY ("PQuotaPolicyID") REFERENCES "Quota_Policy"("QuotaPolicyID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_StartStopID_fkey" FOREIGN KEY ("StartStopID") REFERENCES "Stop"("StopID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_EndStopID_fkey" FOREIGN KEY ("EndStopID") REFERENCES "Stop"("StopID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_RouteID_fkey" FOREIGN KEY ("RouteID") REFERENCES "Route"("RouteID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_StopID_fkey" FOREIGN KEY ("StopID") REFERENCES "Stop"("StopID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusAssignment" ADD CONSTRAINT "BusAssignment_RouteID_fkey" FOREIGN KEY ("RouteID") REFERENCES "Route"("RouteID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularBusAssignment" ADD CONSTRAINT "RegularBusAssignment_RegularBusAssignmentID_fkey" FOREIGN KEY ("RegularBusAssignmentID") REFERENCES "BusAssignment"("BusAssignmentID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularBusAssignment" ADD CONSTRAINT "RegularBusAssignment_LatestBusTripID_fkey" FOREIGN KEY ("LatestBusTripID") REFERENCES "BusTrip"("BusTripID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusTrip" ADD CONSTRAINT "BusTrip_RegularBusAssignmentID_fkey" FOREIGN KEY ("RegularBusAssignmentID") REFERENCES "RegularBusAssignment"("RegularBusAssignmentID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketBusTripAssignment" ADD CONSTRAINT "TicketBusTripAssignment_BusTripID_fkey" FOREIGN KEY ("BusTripID") REFERENCES "BusTrip"("BusTripID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketBusTripAssignment" ADD CONSTRAINT "TicketBusTripAssignment_TicketTypeID_fkey" FOREIGN KEY ("TicketTypeID") REFERENCES "Ticket_Type"("TicketTypeID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBusAssignment" ADD CONSTRAINT "RentalBusAssignment_RentalBusAssignmentID_fkey" FOREIGN KEY ("RentalBusAssignmentID") REFERENCES "BusAssignment"("BusAssignmentID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDriver" ADD CONSTRAINT "RentalDriver_RentalBusAssignmentID_fkey" FOREIGN KEY ("RentalBusAssignmentID") REFERENCES "RentalBusAssignment"("RentalBusAssignmentID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRequest" ADD CONSTRAINT "RentalRequest_RentalBusAssignmentID_fkey" FOREIGN KEY ("RentalBusAssignmentID") REFERENCES "RentalBusAssignment"("RentalBusAssignmentID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_BusAssignmentID_fkey" FOREIGN KEY ("BusAssignmentID") REFERENCES "BusAssignment"("BusAssignmentID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_BusTripID_fkey" FOREIGN KEY ("BusTripID") REFERENCES "BusTrip"("BusTripID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWork" ADD CONSTRAINT "MaintenanceWork_DamageReportID_fkey" FOREIGN KEY ("DamageReportID") REFERENCES "DamageReport"("DamageReportID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_MaintenanceWorkID_fkey" FOREIGN KEY ("MaintenanceWorkID") REFERENCES "MaintenanceWork"("MaintenanceWorkID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTool" ADD CONSTRAINT "TaskTool_TaskID_fkey" FOREIGN KEY ("TaskID") REFERENCES "Task"("TaskID") ON DELETE CASCADE ON UPDATE CASCADE;
