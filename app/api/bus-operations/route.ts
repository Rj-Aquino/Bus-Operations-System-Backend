import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { BusOperationStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache } from '@/lib/cache';

const BUS_OPERATIONS_CACHE_KEY = 'bus_operations_list';
const TTL_SECONDS = 60 * 60; // 1 hour

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Use the status query param as part of the cache key for filtering
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const cacheKey = statusParam
    ? `${BUS_OPERATIONS_CACHE_KEY}_${statusParam}`
    : BUS_OPERATIONS_CACHE_KEY;

  // Try cache first
  const cached = await getCache<any[]>(cacheKey);
  if (cached) {
    // Apply UpdatedAt/UpdatedBy logic to cached data
    const processed = cached.map(item => {
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });
    return NextResponse.json(processed);
  }

  try {
    const whereClause: {
      IsDeleted: boolean;
      Status?: BusOperationStatus;
    } = { IsDeleted: false };

    if (statusParam !== null) {
      const validStatuses = Object.values(BusOperationStatus);
      if (!validStatuses.includes(statusParam as BusOperationStatus)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      whereClause.Status = statusParam as BusOperationStatus;
    }

    // Fetch all bus assignments with their RegularBusAssignment and only the LatestBusTrip
    const busAssignments = await prisma.busAssignment.findMany({
      where: whereClause,
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        BusAssignmentID: true,
        BusID: true,
        Battery: true,
        Lights: true,
        Oil: true,
        Water: true,
        Break: true,
        Air: true,
        Gas: true,
        Engine: true,
        TireCondition: true,
        Self_Driver: true,
        Self_Conductor: true,
        IsDeleted: true,
        Status: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        Route: {
          select: {
            RouteID: true,
            RouteName: true,
          }
        },
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            LatestBusTripID: true,
            LatestBusTrip: {
              select: {
                BusTripID: true,
                DispatchedAt: true,
                CompletedAt: true,
                Sales: true,
                ChangeFund: true,
                Remarks: true,
                TripExpense: true, // <-- updated
                Payment_Method: true, // <-- new
                TicketBusTrips: {
                  select: {
                    TicketBusTripID: true,
                    StartingIDNumber: true,
                    EndingIDNumber: true,
                    TicketType: {
                      select: {
                        TicketTypeID: true,
                        Value: true,
                      },
                    },
                  },
                },
              },
            },
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
                StartDate: true,   // <-- Add this
                EndDate: true,     // <-- And this
                Fixed: {
                  select: {
                    Quota: true,
                  },
                },
                Percentage: {
                  select: {
                    Percentage: true,
                  },
                },
              },
            },
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
          },
        },
      },
    });

    // Remove LatestBusTrip if LatestBusTripID is null and apply UpdatedAt/UpdatedBy logic
      const result = busAssignments.map((assignment) => {
      let regular = assignment.RegularBusAssignment;
      if (regular && regular.LatestBusTripID === null) {
        // Remove LatestBusTrip from the response
        const { LatestBusTrip, ...rest } = regular;
        regular = { ...rest, LatestBusTrip: null };
      }
      // Apply UpdatedAt/UpdatedBy logic to assignment
      let processedAssignment: any = assignment;
      if (
        assignment.CreatedAt &&
        assignment.UpdatedAt &&
        new Date(assignment.CreatedAt).getTime() === new Date(assignment.UpdatedAt).getTime()
      ) {
        processedAssignment = { ...assignment, UpdatedAt: null, UpdatedBy: null } as any;
      }
      // Apply UpdatedAt/UpdatedBy logic to RegularBusAssignment
      if (
        regular &&
        regular.CreatedAt &&
        regular.UpdatedAt &&
        new Date(regular.CreatedAt).getTime() === new Date(regular.UpdatedAt).getTime()
      ) {
        regular = { ...regular, UpdatedAt: null, UpdatedBy: null } as any;
      }
      return {
        ...processedAssignment,
        RegularBusAssignment: regular,
      };
    });

    await setCache(cacheKey, result, TTL_SECONDS);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching bus assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch bus assignments' }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));