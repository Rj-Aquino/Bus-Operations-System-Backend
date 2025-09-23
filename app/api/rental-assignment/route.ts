import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { BusOperationStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

const RENTAL_OPERATIONS_CACHE_KEY = CACHE_KEYS.RENTAL_OPERATIONS_ALL ?? '';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // query params
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const cacheKey = statusParam
    ? `${RENTAL_OPERATIONS_CACHE_KEY}_${statusParam}`
    : RENTAL_OPERATIONS_CACHE_KEY;

  // cache first
  const cached = await getCache<any[]>(cacheKey);
  if (cached) {
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
      IsDeleted?: boolean;
      Status?: BusOperationStatus;
    } = {};

    if (statusParam !== null) {
      const validStatuses = Object.values(BusOperationStatus);
      if (!validStatuses.includes(statusParam as BusOperationStatus)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      whereClause.Status = statusParam as BusOperationStatus;
    }

    // fetch rental bus assignments with relations
    const rentalAssignments = await prisma.rentalBusAssignment.findMany({
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        RentalBusAssignmentID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,

        // relation to BusAssignment
        BusAssignment: {
          select: {
            BusAssignmentID: true,
            BusID: true,
            RouteID: true,
            AssignmentType: true,
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
              },
            },
          },
        },

        // relation to RentalDrivers
        RentalDrivers: {
          select: {
            RentalDriverID: true,
            DriverID: true,
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
          },
        },

        // relation to RentalRequests
        RentalRequests: {
          select: {
            RentalRequestID: true,
            PickupLocation: true,
            DropoffLocation: true,
            NumberOfPassengers: true,
            PickupDateAndTime: true,
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
          },
        },
      },
    });

    // post-process UpdatedAt/UpdatedBy
    const result = rentalAssignments.map((assignment) => {
      let processed = assignment;
      if (
        assignment.CreatedAt &&
        assignment.UpdatedAt &&
        new Date(assignment.CreatedAt).getTime() === new Date(assignment.UpdatedAt).getTime()
      ) {
        processed = { ...assignment, UpdatedAt: null, UpdatedBy: null } as any;
      }
      return processed;
    });

    await setCache(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching rental bus assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch rental bus assignments' }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
