-- CreateEnum
CREATE TYPE "BusOperationStatus" AS ENUM ('NotStarted', 'InOperation', 'Completed');

-- CreateTable
CREATE TABLE "Quota_Policy" (
    "QuotaPolicyID" TEXT NOT NULL,
    "StartDate" TIMESTAMP(3) NOT NULL,
    "EndDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quota_Policy_pkey" PRIMARY KEY ("QuotaPolicyID")
);

-- CreateTable
CREATE TABLE "Fixed" (
    "FQuotaPolicyID" TEXT NOT NULL,
    "Quota" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Fixed_pkey" PRIMARY KEY ("FQuotaPolicyID")
);

-- CreateTable
CREATE TABLE "Percentage" (
    "PQuotaPolicyID" TEXT NOT NULL,
    "Percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Percentage_pkey" PRIMARY KEY ("PQuotaPolicyID")
);

-- CreateTable
CREATE TABLE "Stop" (
    "StopID" TEXT NOT NULL,
    "StopName" TEXT NOT NULL,
    "latitude" TEXT NOT NULL,
    "longitude" TEXT NOT NULL,
    "IsDeleted" BOOLEAN NOT NULL,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("StopID")
);

-- CreateTable
CREATE TABLE "Route" (
    "RouteID" TEXT NOT NULL,
    "StartStopID" TEXT NOT NULL,
    "EndStopID" TEXT NOT NULL,
    "RouteName" TEXT NOT NULL,
    "IsDeleted" BOOLEAN NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("RouteID")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "RouteStopID" TEXT NOT NULL,
    "RouteID" TEXT NOT NULL,
    "StopID" TEXT NOT NULL,
    "StopOrder" INTEGER NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("RouteStopID")
);

-- CreateTable
CREATE TABLE "Ticket_Type" (
    "TicketTypeID" TEXT NOT NULL,
    "Value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Ticket_Type_pkey" PRIMARY KEY ("TicketTypeID")
);

-- CreateTable
CREATE TABLE "TicketBusAssignment" (
    "TicketBusAssignmentID" TEXT NOT NULL,
    "BusAssignmentID" TEXT NOT NULL,
    "TicketTypeID" TEXT NOT NULL,
    "StartingIDNumber" INTEGER NOT NULL,
    "EndingIDNumber" INTEGER NOT NULL,

    CONSTRAINT "TicketBusAssignment_pkey" PRIMARY KEY ("TicketBusAssignmentID")
);

-- CreateTable
CREATE TABLE "BusAssignment" (
    "BusAssignmentID" TEXT NOT NULL,
    "BusID" TEXT NOT NULL,
    "RouteID" TEXT NOT NULL,
    "AssignmentDate" TIMESTAMP(3) NOT NULL,
    "Battery" BOOLEAN NOT NULL DEFAULT false,
    "Lights" BOOLEAN NOT NULL DEFAULT false,
    "Oil" BOOLEAN NOT NULL DEFAULT false,
    "Water" BOOLEAN NOT NULL DEFAULT false,
    "Break" BOOLEAN NOT NULL DEFAULT false,
    "Air" BOOLEAN NOT NULL DEFAULT false,
    "Gas" BOOLEAN NOT NULL DEFAULT false,
    "Engine" BOOLEAN NOT NULL DEFAULT false,
    "TireCondition" BOOLEAN NOT NULL DEFAULT false,
    "Self_Driver" BOOLEAN NOT NULL DEFAULT false,
    "Self_Conductor" BOOLEAN NOT NULL DEFAULT false,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "Status" "BusOperationStatus" NOT NULL DEFAULT 'NotStarted',

    CONSTRAINT "BusAssignment_pkey" PRIMARY KEY ("BusAssignmentID")
);

-- CreateTable
CREATE TABLE "RegularBusAssignment" (
    "RegularBusAssignmentID" TEXT NOT NULL,
    "DriverID" TEXT NOT NULL,
    "ConductorID" TEXT NOT NULL,
    "QuotaPolicyID" TEXT NOT NULL,
    "Change" DOUBLE PRECISION NOT NULL,
    "TripRevenue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RegularBusAssignment_pkey" PRIMARY KEY ("RegularBusAssignmentID")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_RouteID_StopID_key" ON "RouteStop"("RouteID", "StopID");

-- CreateIndex
CREATE INDEX "BusAssignment_BusID_idx" ON "BusAssignment"("BusID");

-- CreateIndex
CREATE INDEX "RegularBusAssignment_DriverID_idx" ON "RegularBusAssignment"("DriverID");

-- CreateIndex
CREATE INDEX "RegularBusAssignment_ConductorID_idx" ON "RegularBusAssignment"("ConductorID");

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
ALTER TABLE "TicketBusAssignment" ADD CONSTRAINT "TicketBusAssignment_BusAssignmentID_fkey" FOREIGN KEY ("BusAssignmentID") REFERENCES "BusAssignment"("BusAssignmentID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketBusAssignment" ADD CONSTRAINT "TicketBusAssignment_TicketTypeID_fkey" FOREIGN KEY ("TicketTypeID") REFERENCES "Ticket_Type"("TicketTypeID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusAssignment" ADD CONSTRAINT "BusAssignment_RouteID_fkey" FOREIGN KEY ("RouteID") REFERENCES "Route"("RouteID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularBusAssignment" ADD CONSTRAINT "RegularBusAssignment_QuotaPolicyID_fkey" FOREIGN KEY ("QuotaPolicyID") REFERENCES "Quota_Policy"("QuotaPolicyID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularBusAssignment" ADD CONSTRAINT "RegularBusAssignment_RegularBusAssignmentID_fkey" FOREIGN KEY ("RegularBusAssignmentID") REFERENCES "BusAssignment"("BusAssignmentID") ON DELETE RESTRICT ON UPDATE CASCADE;
