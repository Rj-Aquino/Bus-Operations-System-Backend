import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { RentalRequestStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { delCache, CACHE_KEYS } from '@/lib/cache';

const RENTAL_REQUESTS_CACHE_KEY = CACHE_KEYS.RENTAL_REQUESTS_ALL ?? '';

const putHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const url = new URL(request.url);
    const RentalRequestID = url.pathname.split('/').pop();

    if (!RentalRequestID) {
      return NextResponse.json({ error: 'RentalRequestID is required in the URL' }, { status: 400 });
    }

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

    // Validate required fields
    if (!PickupLocation || !DropoffLocation || !NumberOfPassengers || !PickupDateAndTime || !CustomerName || !CustomerContact) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize status
    let normalizedStatus: RentalRequestStatus = RentalRequestStatus.Pending;
    if (Status) {
      const validStatuses = Object.values(RentalRequestStatus);
      const found = validStatuses.find(s => s.toLowerCase() === Status.toLowerCase());
      if (!found) return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      normalizedStatus = found as RentalRequestStatus;
    }

    const updatedRentalRequest = await prisma.rentalRequest.update({
      where: { RentalRequestID },
      data: {
        RentalBusAssignmentID: RentalBusAssignmentID || null, // Nullable
        PickupLocation,
        DropoffLocation,
        NumberOfPassengers,
        PickupDateAndTime: new Date(PickupDateAndTime),
        ExpectedArrivalTime: ExpectedArrivalTime ? new Date(ExpectedArrivalTime) : null,
        SpecialRequirements: SpecialRequirements || null,
        Status: normalizedStatus,
        CustomerName,
        CustomerContact,
        UpdatedBy: user?.userId || null,
      },
    });

    // Invalidate cache
    await delCache(RENTAL_REQUESTS_CACHE_KEY);

    return NextResponse.json(updatedRentalRequest, { status: 200 });
  } catch (err) {
    console.error('UPDATE_RENTAL_REQUEST_ERROR', err);
    return NextResponse.json({ error: 'Failed to update rental request' }, { status: 500 });
  }
};

const patchHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const url = new URL(request.url);
    const RentalRequestID = url.pathname.split('/').pop();

    if (!RentalRequestID) {
      return NextResponse.json({ error: 'RentalRequestID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { IsDeleted } = body;

    if (typeof IsDeleted !== 'boolean') {
      return NextResponse.json({ error: '`IsDeleted` must be a boolean' }, { status: 400 });
    }

    const updated = await prisma.rentalRequest.update({
      where: { RentalRequestID },
      data: {
        IsDeleted,
        UpdatedBy: user?.userId || null,
      },
      select: {
        RentalRequestID: true,
        IsDeleted: true,
        UpdatedBy: true,
        UpdatedAt: true,
      },
    });

    // Invalidate cache
    await delCache(RENTAL_REQUESTS_CACHE_KEY);

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('PATCH_RENTAL_REQUEST_ERROR', error);
    return NextResponse.json({ error: 'Failed to update rental request' }, { status: 500 });
  }
};

export const PUT = withCors(putHandler);
export const PATCH = withCors(patchHandler);

export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
