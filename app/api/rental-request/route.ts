import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { RentalRequestStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';
import { generateFormattedID } from '@/lib/idGenerator';

const RENTAL_REQUESTS_CACHE_KEY = CACHE_KEYS.RENTAL_REQUESTS_ALL ?? '';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // Optional status query param
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const cacheKey = statusParam
    ? `${RENTAL_REQUESTS_CACHE_KEY}_${statusParam}`
    : RENTAL_REQUESTS_CACHE_KEY;

  // Try cache first
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
    const whereClause: { Status?: RentalRequestStatus; IsDeleted?: boolean } = {
      IsDeleted: false, // filter out deleted records
    };

    if (statusParam !== null) {
    const validStatuses = Object.values(RentalRequestStatus);

    // Find enum value ignoring case
    const normalizedStatus = validStatuses.find(
        s => s.toLowerCase() === statusParam.toLowerCase()
    ) as RentalRequestStatus | undefined;

    if (!normalizedStatus) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    whereClause.Status = normalizedStatus;
    }

    // Fetch RentalRequests
    const rentalRequests = await prisma.rentalRequest.findMany({
      where: whereClause,
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        RentalRequestID: true,
        RentalBusAssignmentID: true,
        PickupLocation: true,
        DropoffLocation: true,
        NumberOfPassengers: true,
        PickupDateAndTime: true,
        ExpectedArrivalTime: true,
        SpecialRequirements: true,
        Status: true,
        CustomerName: true,
        CustomerContact: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        RentalBusAssignment: {
          select: {
            RentalBusAssignmentID: true,
            // Add other related fields if needed
          },
        },
      },
    });

    // Apply UpdatedAt/UpdatedBy logic
    const result = rentalRequests.map(rr => {
    if (rr.CreatedAt.getTime() === rr.UpdatedAt.getTime()) {
        return { ...rr, UpdatedAt: null, UpdatedBy: null } as any;
    }
    return rr;
    });

    await setCache(cacheKey, result);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error fetching rental requests:', err);
    return NextResponse.json({ error: 'Failed to fetch rental requests' }, { status: 500 });
  }
};

const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();

    const {
      RentalBusAssignmentID,
      PickupLocation,
      DropoffLocation,
      NumberOfPassengers,
      PickupDateAndTime,
      ExpectedArrivalTime,
      SpecialRequirements,
      Status,
      CustomerName,
      CustomerContact,
    } = body;

    if (!PickupLocation || !DropoffLocation ||
        !NumberOfPassengers || !PickupDateAndTime || !CustomerName || !CustomerContact) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let normalizedStatus: RentalRequestStatus = RentalRequestStatus.Pending;
    if (Status) {
      const validStatuses = Object.values(RentalRequestStatus);
      const found = validStatuses.find(s => s.toLowerCase() === Status.toLowerCase());
      if (!found) return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      normalizedStatus = found as RentalRequestStatus;
    }

    const newRentalRequest = await prisma.rentalRequest.create({
    data: {
        RentalRequestID: generateFormattedID('RR'),
        RentalBusAssignmentID: RentalBusAssignmentID || null,
        PickupLocation,
        DropoffLocation,
        NumberOfPassengers,
        PickupDateAndTime: new Date(PickupDateAndTime),
        ExpectedArrivalTime: ExpectedArrivalTime ? new Date(ExpectedArrivalTime) : null,
        SpecialRequirements: SpecialRequirements || null,
        Status: normalizedStatus,
        CustomerName,
        CustomerContact,
        CreatedBy: user?.userId || null,
    },
    });

    // Invalidate cache
    await setCache(RENTAL_REQUESTS_CACHE_KEY, null);

    return NextResponse.json(newRentalRequest, { status: 201 });
  } catch (err) {
    console.error('Error creating rental request:', err);
    return NextResponse.json({ error: 'Failed to create rental request' }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
