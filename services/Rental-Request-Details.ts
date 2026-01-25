import prisma from '@/client';
import { RentalRequestStatus } from '@prisma/client';
import { fetchNewBuses, fetchNewDrivers } from '@/lib/fetchExternal';
import { getCache, setCache, delCache, CACHE_KEYS } from '@/lib/cache';

// const RENTAL_REQUEST_DETAILS_CACHE_KEY = CACHE_KEYS.RENTAL_REQUEST_DETAILS ?? '';

interface RentalSummary {
  assignment_id: string | null;
  bus_id: string | null;
  bus_plate_number: string;
  bus_type: string;
  body_number: string;
  rental_status: string;
  rental_details: {
    rental_package: string | null;
    rental_start_date: Date;
    rental_end_date: string;
    total_rental_amount: number | null;
    down_payment_amount: number | null;
    balance_amount: number | null;
    down_payment_date: Date | null;
    full_payment_date: Date | null;
    cancelled_at: Date | null;
    cancellation_reason: string | null;
  };
  employees: Array<{
    employee_id: string;
    employee_firstName: string | null;
    employee_middleName: string | null;
    employee_lastName: string | null;
    employee_position_name: string;
  }>;
}

export class RentalRequestDetailsService {
  private parseStatusFilter(filterStatus: string | null): RentalRequestStatus | undefined {
    if (!filterStatus) return undefined;

    const statusMap: Record<string, RentalRequestStatus> = {
      pending: RentalRequestStatus.Pending,
      approved: RentalRequestStatus.Approved,
      rejected: RentalRequestStatus.Rejected,
      completed: RentalRequestStatus.Completed,
    };

    return statusMap[filterStatus.toLowerCase()];
  }

  private async buildLookupMaps(): Promise<{
    busMap: Record<string, any>;
    driverMap: Record<string, any>;
  }> {
    const [buses, drivers] = await Promise.all([
      fetchNewBuses().catch(() => []),
      fetchNewDrivers().catch(() => []),
    ]);

    const busesArr = Array.isArray(buses) ? buses : buses?.data ?? [];
    const driversArr = Array.isArray(drivers) ? drivers : drivers?.data ?? [];

    const busMap = Object.fromEntries(
      busesArr.map((b: any) => [b.id ?? b.bus_id ?? b.busId, b])
    );

    const driverMap = Object.fromEntries(
      driversArr.map((d: any) => [d.employeeNumber ?? d.driver_id, d])
    );

    return { busMap, driverMap };
  }

  private formatRentalSummary(
    rentalRequest: any,
    busMap: Record<string, any>,
    driverMap: Record<string, any>
  ): RentalSummary {
    const assignment = rentalRequest.RentalBusAssignment;
    const bus = assignment?.BusAssignment
      ? busMap[assignment.BusAssignment.BusID ?? ''] ?? {}
      : {};

    const employees = (assignment?.RentalDrivers ?? []).map((d: any) => {
      const driverInfo = driverMap[d.DriverID] ?? {};
      return {
        employee_id: d.DriverID,
        employee_firstName:
          driverInfo.firstName ?? driverInfo.name?.split(' ')[0] ?? null,
        employee_middleName: driverInfo.middleName ?? null,
        employee_lastName:
          driverInfo.lastName ?? driverInfo.name?.split(' ')[1] ?? null,
        employee_position_name: 'Driver',
      };
    });

    const rentalStartDate = new Date(rentalRequest.RentalDate);
    const rentalEndDate = new Date(
      rentalStartDate.getTime() +
        (rentalRequest.Duration ?? 0) * 24 * 60 * 60 * 1000
    );

    return {
      assignment_id: assignment?.RentalBusAssignmentID ?? null,
      bus_id: bus?.id ?? null,
      bus_plate_number:
        bus.plate_number ?? bus.license_plate ?? 'Unknown',
      bus_type: bus.bus_type ?? bus.type ?? 'Unknown',
      body_number: bus.body_number ?? 'Unknown',
      rental_status: rentalRequest.Status.toLowerCase(),
      rental_details: {
        rental_package: rentalRequest.RouteName,
        rental_start_date: rentalStartDate,
        rental_end_date: rentalEndDate.toISOString(),
        total_rental_amount: rentalRequest.TotalRentalAmount,
        down_payment_amount: rentalRequest.DownPaymentAmount,
        balance_amount: rentalRequest.BalanceAmount,
        down_payment_date: rentalRequest.DownPaymentDate,
        full_payment_date: rentalRequest.FullPaymentDate,
        cancelled_at: rentalRequest.CancelledAtDate,
        cancellation_reason: rentalRequest.CancelledReason,
      },
      employees,
    };
  }

  async getRentalRequestDetails(filterStatus: string | null): Promise<RentalSummary[]> {
    // Build cache key with filter
    // const cacheKey =
    //   filterStatus && filterStatus.length > 0
    //     ? `${RENTAL_REQUEST_DETAILS_CACHE_KEY}_${filterStatus.toLowerCase()}`
    //     : RENTAL_REQUEST_DETAILS_CACHE_KEY;

    // // Try cache first
    // const cached = await getCache<RentalSummary[]>(cacheKey);
    // if (cached) {
    //   return cached;
    // }

    // Parse status filter
    const statusFilter = this.parseStatusFilter(filterStatus);

    // Fetch rental requests from database
    const rentalRequests = await prisma.rentalRequest.findMany({
      where: {
        IsDeleted: false,
        ...(statusFilter ? { Status: statusFilter } : {}),
      },
      orderBy: { CreatedAt: 'desc' },
      include: {
        RentalBusAssignment: {
          include: {
            BusAssignment: true,
            RentalDrivers: true,
          },
        },
      },
    });

    // Build lookup maps
    const { busMap, driverMap } = await this.buildLookupMaps();

    // Format results
    const results = rentalRequests.map(r =>
      this.formatRentalSummary(r, busMap, driverMap)
    );

    // Cache results
    // await setCache(cacheKey, results);

    return results;
  }

//   async invalidateCache(): Promise<void> {
//     await Promise.all([
//       delCache(RENTAL_REQUEST_DETAILS_CACHE_KEY),
//       delCache(`${RENTAL_REQUEST_DETAILS_CACHE_KEY}_pending`),
//       delCache(`${RENTAL_REQUEST_DETAILS_CACHE_KEY}_approved`),
//       delCache(`${RENTAL_REQUEST_DETAILS_CACHE_KEY}_rejected`),
//       delCache(`${RENTAL_REQUEST_DETAILS_CACHE_KEY}_completed`),
//     ]);
//   }
}