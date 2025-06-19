import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { withCors } from '@/lib/withcors';
import { authenticateRequest } from '@/lib/auth';
import { BusOperationStatus } from '@prisma/client';

const getAssignmentSummary = async (request: NextRequest) => {
  const { error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Only assignments that are not deleted, InOperation, have a LatestBusTrip, and that trip has TripExpense and Sales not null
  const assignments = await prisma.busAssignment.findMany({
    where: {
      IsDeleted: false,
      Status: BusOperationStatus.InOperation,
      RegularBusAssignment: {
        LatestBusTrip: {
          TripExpense: { not: null },
          Sales: { not: null },
        },
      },
    },
    select: {
      BusAssignmentID: true,
      Route: { select: { RouteName: true } },
      RegularBusAssignment: {
        select: {
          LatestBusTrip: {
            select: {
              DispatchedAt: true,
              TripExpense: true,
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

  // Map to the required format
  const result = assignments.map(a => {
    const trip = a.RegularBusAssignment?.LatestBusTrip;
    const quotaPolicies = a.RegularBusAssignment?.QuotaPolicies || [];

   

    // Find the quota policy where DispatchedAt is within StartDate and EndDate
    let quotaPolicy = null;
    if (trip?.DispatchedAt) {
      quotaPolicies.forEach(qp => {
        console.log(
          `[DEBUG] DispatchedAt: ${trip.DispatchedAt ? trip.DispatchedAt.toISOString() : 'null'}, StartDate: ${qp.StartDate?.toISOString()}, EndDate: ${qp.EndDate?.toISOString()}`
        );
      });
      quotaPolicy = quotaPolicies.find(qp =>
        qp.StartDate && qp.EndDate &&
        trip.DispatchedAt != null &&
        trip.DispatchedAt >= qp.StartDate &&
        trip.DispatchedAt <= qp.EndDate
      );
      console.log('[DEBUG] Matched QuotaPolicy:', quotaPolicy);
    }

    let assignment_type = null;
    let assignment_value = null;
    if (quotaPolicy?.Fixed) {
      assignment_type = 'Boundary';
      assignment_value = quotaPolicy.Fixed.Quota;
    } else if (quotaPolicy?.Percentage) {
      assignment_type = 'Percentage';
      assignment_value = quotaPolicy.Percentage.Percentage;
    } else {
      assignment_type = 'Bus Rental';
      assignment_value = null;
    }

    return {
      assignment_id: a.BusAssignmentID,
      bus_route: a.Route?.RouteName || null,
      date_assigned: trip?.DispatchedAt ? trip.DispatchedAt.toISOString() : null,
      trip_fuel_expense: trip?.TripExpense ?? null,
      trip_revenue: trip?.Sales ?? null,
      is_expense_recorded: trip?.TripExpense != null,
      is_revenue_recorded: trip?.Sales != null,
      assignment_type,
      assignment_value,
      payment_method: trip?.Payment_Method ?? null,
    };
  });

  return NextResponse.json(result, { status: 200 });
};

export const GET = withCors(getAssignmentSummary);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));