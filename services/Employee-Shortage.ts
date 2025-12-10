import prisma from '@/client';

export class EmployeeShortageService {
  private findQuotaPolicy(quotaPolicies: any[], dispatchedAt: Date | null): any {
    if (!dispatchedAt) return null;

    return quotaPolicies.find(
      qp =>
        qp.StartDate &&
        qp.EndDate &&
        dispatchedAt >= qp.StartDate &&
        dispatchedAt <= qp.EndDate
    );
  }

  private calculateQuotaAmount(quotaPolicy: any, sales: number | null): number {
    if (!quotaPolicy) return 0;

    if (quotaPolicy?.Fixed?.Quota) {
      return quotaPolicy.Fixed.Quota;
    }

    if (quotaPolicy?.Percentage?.Percentage && sales) {
      return sales * quotaPolicy.Percentage.Percentage;
    }

    return 0;
  }

  private calculateShortage(
    sales: number,
    quotaAmount: number,
    tripExpense: number | null,
    paymentMethod: string | null,
    pettyCash: number | null
  ): number {
    let shortage = sales - quotaAmount - (tripExpense ?? 0);

    if (paymentMethod === 'Company_Cash') {
      shortage -= pettyCash ?? 0;
    }

    if (shortage < 0) {
      shortage = Math.abs(shortage);
      return shortage / 2; // Divide by 2 for driver and conductor
    }

    return 0;
  }

  async getEmployeeShortages(): Promise<
    Array<{ EmployeeNo: string; Shortage: number; CompletedAt: string | null }>
  > {
    // Fetch assignments with needed IDs and all BusTrips
    const assignments = await prisma.busAssignment.findMany({
      where: {
        IsDeleted: false,
        RegularBusAssignment: {
          BusTrips: {
            some: {
              TripExpense: { not: null },
              Sales: { not: null },
            },
          },
        },
      },
      select: {
        BusAssignmentID: true,
        BusID: true,
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            BusTrips: {
              where: {
                TripExpense: { not: null },
                Sales: { not: null },
              },
              select: {
                DispatchedAt: true,
                TripExpense: true,
                PettyCash: true,
                Sales: true,
                Payment_Method: true,
              },
            },
            QuotaPolicies: {
              select: {
                StartDate: true,
                EndDate: true,
                Fixed: { select: { Quota: true } },
                Percentage: { select: { Percentage: true } },
              },
            },
          },
        },
      },
    });

    console.log('Assignments fetched:', assignments.length);

    // Map to shortages
    const shortages: Array<{ EmployeeNo: string; Shortage: number; CompletedAt: string | null }> = [];

    for (const a of assignments) {
      const busTrips = a.RegularBusAssignment?.BusTrips || [];
      const quotaPolicies = a.RegularBusAssignment?.QuotaPolicies || [];

      for (const trip of busTrips) {
        // Validate required fields
        if (trip?.Sales == null || trip?.DispatchedAt == null) {
          console.log(
            `Missing sales or dispatchedAt for assignment ${a.BusAssignmentID}`
          );
          continue;
        }

        // Find the quota policy where DispatchedAt is within StartDate and EndDate
        const quotaPolicy = this.findQuotaPolicy(quotaPolicies, trip.DispatchedAt);

        if (!quotaPolicy) {
          console.log(
            `No quota policy found for assignment ${a.BusAssignmentID} at ${trip?.DispatchedAt}`
          );
          continue;
        }

        // Calculate quota amount
        const quotaAmount = this.calculateQuotaAmount(quotaPolicy, trip.Sales);

        if (quotaAmount === 0 && !quotaPolicy?.Fixed?.Quota && !quotaPolicy?.Percentage?.Percentage) {
          console.log(`No quota amount for assignment ${a.BusAssignmentID}`);
          continue;
        }

        // Calculate shortage
        const shortagePerPerson = this.calculateShortage(
          trip.Sales,
          quotaAmount,
          trip.TripExpense ?? null,
          trip.Payment_Method ?? null,
          trip.PettyCash ?? null
        );

        console.log(`Shortage for assignment ${a.BusAssignmentID}: ${shortagePerPerson}`);
        console.log(`Trip Sales: ${trip.Sales}, Quota Amount: ${quotaAmount}`);
        console.log(`Trip Payment Method: ${trip.Payment_Method}`);
        console.log(`Trip Expense: ${trip.TripExpense}`);
        console.log(`Trip Petty Cash: ${trip.PettyCash}`);

        // Push for Driver
        if (a.RegularBusAssignment?.DriverID) {
          shortages.push({
            EmployeeNo: a.RegularBusAssignment.DriverID,
            Shortage: shortagePerPerson,
            CompletedAt: trip.DispatchedAt.toISOString(),
          });
        }

        // Push for Conductor
        if (a.RegularBusAssignment?.ConductorID) {
          shortages.push({
            EmployeeNo: a.RegularBusAssignment.ConductorID,
            Shortage: shortagePerPerson,
            CompletedAt: trip.DispatchedAt.toISOString(),
          });
        }
      }
    }

    return shortages;
  }

}