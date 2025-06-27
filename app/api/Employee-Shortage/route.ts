import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { withCors } from '@/lib/withcors';
import { authenticateRequest } from '@/lib/auth';

const getEmployeeShortage = async (request: NextRequest) => {
  // const { error, token, status } = await authenticateRequest(request);
  // if (error) {
  //   console.log('Auth error:', error);
  //   return NextResponse.json({ error }, { status });
  // }

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

  console.log('Assignments fetched:', assignments);

  // Map to shortages
  const shortages: Array<{ EmployeeNo: string, Shortage: number, CompletedAt: string | null }> = [];

  for (const a of assignments) {
    const busTrips = a.RegularBusAssignment?.BusTrips || [];
    const quotaPolicies = a.RegularBusAssignment?.QuotaPolicies || [];
    for (const trip of busTrips) {
      // Find the quota policy where DispatchedAt is within StartDate and EndDate
      let quotaPolicy = null;
      if (trip?.DispatchedAt) {
        quotaPolicy = quotaPolicies.find(qp =>
          qp.StartDate && qp.EndDate &&
          trip.DispatchedAt != null &&
          trip.DispatchedAt >= qp.StartDate &&
          trip.DispatchedAt <= qp.EndDate
        );
      }

      if (!quotaPolicy) {
        console.log(`No quota policy found for assignment ${a.BusAssignmentID} at ${trip?.DispatchedAt}`);
        continue;
      }

      let quotaAmount = 0;
      if (quotaPolicy?.Fixed?.Quota) {
        quotaAmount = quotaPolicy.Fixed.Quota;
      } else if (quotaPolicy?.Percentage?.Percentage) {
        quotaAmount = trip?.Sales ?  (trip.Sales * quotaPolicy.Percentage.Percentage) : 0;
      } else {
        console.log(`No quota amount for assignment ${a.BusAssignmentID}`);
        continue; // skip if quota not defined
      }

      if (trip?.Sales == null || trip?.DispatchedAt == null) {
        console.log(`Missing sales or dispatchedAt for assignment ${a.BusAssignmentID}`);
        continue;
      }

      let shortage = trip.Sales - quotaAmount - (trip.TripExpense ?? 0);
      console.log(`Shortage for assignment ${a.BusAssignmentID}: ${shortage}`);
      console.log(`Trip Sales: ${trip.Sales}, Quota Amount: ${quotaAmount}`);
      console.log(`Trip Payment Method: ${trip.Payment_Method}`);
      console.log(`Trip Expense: ${trip.TripExpense}`);
      console.log(`Trip Petty Cash: ${trip.PettyCash}`);
      
      if (trip.Payment_Method === 'Company_Cash') {
          shortage -= trip.PettyCash ?? 0;
          console.log( `Adjusted shortage for Company Cash Inside If Block: ${shortage}`);
      }

      let shortagePerPerson = 0;

      if( shortage < 0) {
        shortage = Math.abs(shortage);
        shortagePerPerson = shortage / 2;
      } 
    
      // Push for Driver
      if (a.RegularBusAssignment?.DriverID) {
        shortages.push({
          EmployeeNo: a.RegularBusAssignment.DriverID,
          Shortage: shortagePerPerson,
          CompletedAt: trip.DispatchedAt ? trip.DispatchedAt.toISOString() : null,
        });
      }
      // Push for Conductor
      if (a.RegularBusAssignment?.ConductorID) {
        shortages.push({
          EmployeeNo: a.RegularBusAssignment.ConductorID,
          Shortage: shortagePerPerson,
          CompletedAt: trip.DispatchedAt ? trip.DispatchedAt.toISOString() : null,
        });
      }
    }
  }

  return NextResponse.json(shortages, { status: 200 });
};

export const GET = withCors(getEmployeeShortage);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));