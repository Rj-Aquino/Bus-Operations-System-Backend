import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { BusOperationStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

const RENTAL_OPERATIONS_CACHE_KEY = CACHE_KEYS.RENTAL_OPERATIONS_ALL ?? '';

export const GET = withCors(async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status')?.toUpperCase() ?? null;

  const cacheKey = statusParam
    ? `${RENTAL_OPERATIONS_CACHE_KEY}_${statusParam}`
    : RENTAL_OPERATIONS_CACHE_KEY;

  // Cache check
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
    let statusClause: BusOperationStatus | undefined = undefined;
    const validStatuses = Object.values(BusOperationStatus);

    if (statusParam) {
      const match = validStatuses.find(s => s.toUpperCase() === statusParam);
      if (!match) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      statusClause = match;
    }

    const whereClause: any = {
      BusAssignment: {
        IsDeleted: false,
        ...(statusClause ? { Status: statusClause } : {}),
      }
    };

    const rentalAssignments = await prisma.rentalBusAssignment.findMany({
      where: whereClause,
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        RentalBusAssignmentID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,

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

    const result = rentalAssignments.map(assignment => {
      let processed = assignment;
      if (
        assignment.CreatedAt &&
        assignment.UpdatedAt &&
        new Date(assignment.CreatedAt).getTime() === new Date(assignment.UpdatedAt).getTime()
      ) {
        processed = { ...assignment, UpdatedAt: null as any, UpdatedBy: null };

      }
      return processed;
    });

    await setCache(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching rental bus assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch rental bus assignments' }, { status: 500 });
  }
});

export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
