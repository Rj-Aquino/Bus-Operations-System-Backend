import { NextRequest, NextResponse } from "next/server";
import prisma from "@/client";
import { withCors } from "@/lib/withcors";
import { fetchNewBuses, fetchNewDrivers } from "@/lib/fetchExternal";
import { RentalRequestStatus } from "@prisma/client"; // Import enum

const getAllRentalSummaries = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const filterStatus = searchParams.get("status")?.toLowerCase(); // optional: "active", "completed", "cancelled"

    console.log("Filter Status:", filterStatus);

  // Convert string to enum if provided
  let statusFilter: RentalRequestStatus | undefined = undefined;
  if (filterStatus) {
    switch (filterStatus) {
      case "pending":
        statusFilter = RentalRequestStatus.Pending;
        break;
      case "approved":
        statusFilter = RentalRequestStatus.Approved;
        break;
      case "rejected":
        statusFilter = RentalRequestStatus.Rejected;
        break;
      case "completed":
        statusFilter = RentalRequestStatus.Completed;
        break;
      default:
        statusFilter = undefined;
    }
  }

  // Fetch all Rental Requests (optionally filtered by status)
  const rentalRequests = await prisma.rentalRequest.findMany({
    where: {
      IsDeleted: false,
      ...(statusFilter ? { Status: statusFilter } : {}),
    },
    orderBy: { CreatedAt: "desc" },
    include: {
      RentalBusAssignment: {
        include: {
          BusAssignment: true,
          RentalDrivers: true,
        },
      },
    },
  });

  // Fetch external data
  const [buses, drivers] = await Promise.all([fetchNewBuses(), fetchNewDrivers()]);
  const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];
  const driversArr = Array.isArray(drivers) ? drivers : drivers?.data ?? [];

  const busMap = Object.fromEntries(busesArr.map((b: any) => [b.bus_id ?? b.busId, b]));
  const driverMap = Object.fromEntries(driversArr.map((d: any) => [d.employeeNumber ?? d.driver_id, d]));

  const results = rentalRequests.map((r) => {
    const assignment = r.RentalBusAssignment;
    const bus = assignment?.BusAssignment ? busMap[assignment.BusAssignment.BusID ?? ""] ?? {} : {};

    const employees = assignment?.RentalDrivers.map((d: any) => {
      const driverInfo = driverMap[d.DriverID] ?? {};
      return {
        employee_id: d.DriverID,
        employee_firstName: driverInfo.firstName ?? driverInfo.name?.split(" ")[0] ?? null,
        employee_middleName: driverInfo.middleName ?? null,
        employee_lastName: driverInfo.lastName ?? driverInfo.name?.split(" ")[1] ?? null,
        employee_position_name: "Driver",
      };
    }) ?? [];

    return {
      assignment_id: assignment?.RentalBusAssignmentID ?? null,
      bus_plate_number: bus.plate_number ?? bus.license_plate ?? "Unknown",
      bus_type: bus.bus_type ?? bus.type ?? "Unknown",
      body_number: bus.body_number ?? "Unknown",

      rental_status: r.Status.toLowerCase(),
      rental_details: {
        rental_package: r.RouteName,
        rental_start_date: r.RentalDate,
        rental_end_date: new Date(r.RentalDate.getTime() + (r.Duration ?? 0) * 24 * 60 * 60 * 1000).toISOString(),
        total_rental_amount: r.TotalRentalAmount,
        down_payment_amount: r.DownPaymentAmount,
        balance_amount: r.BalanceAmount,
        down_payment_date: r.DownPaymentDate,
        full_payment_date: r.FullPaymentDate,
        cancelled_at: r.CancelledAtDate,
        cancellation_reason: r.CancelledReason,
      },

      employees,
    };
  });

  return NextResponse.json(results, { status: 200 });
};

export const GET = withCors(getAllRentalSummaries);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
