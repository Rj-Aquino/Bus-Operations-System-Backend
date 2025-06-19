import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache } from '@/lib/cache';

const READY_ASSIGNMENTS_CACHE_KEY = 'bus_operations_ready_assignments';
const TTL_SECONDS = 60 * 60; // 1 hour

const getVerifiedAssignments = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Try cache first
  const cached = await getCache<any[]>(READY_ASSIGNMENTS_CACHE_KEY);
  if (cached) {
    // Apply UpdatedAt/UpdatedBy logic to cached data
    const processed = cached.map(item => {
      let processedItem: any = item;
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        processedItem = { ...processedItem, UpdatedAt: null, UpdatedBy: null };
      }
      // For RegularBusAssignment
      if (
        item.RegularBusAssignment &&
        item.RegularBusAssignment.CreatedAt &&
        item.RegularBusAssignment.UpdatedAt &&
        new Date(item.RegularBusAssignment.CreatedAt).getTime() === new Date(item.RegularBusAssignment.UpdatedAt).getTime()
      ) {
        processedItem.RegularBusAssignment = {
          ...processedItem.RegularBusAssignment,
          UpdatedAt: null,
          UpdatedBy: null,
        };
      }
      return processedItem;
    });
    return NextResponse.json(processed);
  }

  try {
    const verifiedAssignments = await prisma.busAssignment.findMany({
      where: {
        IsDeleted: false,
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
        RegularBusAssignment: {
          isNot: null,
        },
      },
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
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
          },
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
    const result = verifiedAssignments.map((assignment) => {
      let regular = assignment.RegularBusAssignment;
      if (regular && regular.LatestBusTripID === null) {
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
      // Apply UpdatedAt/UpdatedBy logic to Route
      let route = assignment.Route;
      if (
        route &&
        route.CreatedAt &&
        route.UpdatedAt &&
        new Date(route.CreatedAt).getTime() === new Date(route.UpdatedAt).getTime()
      ) {
        route = { ...route, UpdatedAt: null, UpdatedBy: null } as any;
      }
      return {
        ...processedAssignment,
        RegularBusAssignment: regular,
        Route: route,
      };
    });

    await setCache(READY_ASSIGNMENTS_CACHE_KEY, result, TTL_SECONDS);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching verified assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch verified assignments' }, { status: 500 });
  }
};

export const GET = withCors(getVerifiedAssignments);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));