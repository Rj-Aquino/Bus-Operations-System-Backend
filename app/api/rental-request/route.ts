import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { RentalRequestStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';
import { generateFormattedID } from '@/lib/idGenerator';
import { fetchBuses, fetchNewBuses } from '@/lib/fetchExternal';

const RENTAL_REQUESTS_CACHE_KEY = CACHE_KEYS.RENTAL_REQUESTS_ALL ?? '';

export const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status');

    const whereClause: { Status?: any; IsDeleted?: boolean } = { IsDeleted: false };

    let normalizedStatus: string | undefined;
    if (statusParam) {
      const validStatuses = ['Pending', 'Approved', 'Rejected', 'Completed'];
      normalizedStatus = validStatuses.find(s => s.toLowerCase() === statusParam.toLowerCase());
      if (!normalizedStatus) return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      whereClause.Status = normalizedStatus;
    }

    // Build include clause per requirements:
    // - Always include RentalBusAssignment so requests are returned for all statuses
    // - Approved: include only minimal fields from RentalBusAssignment (no battery/light/etc) but include full BusAssignment and drivers
    // - Completed: include full RentalBusAssignment (all its scalar fields) and minimal nested BusAssignment & RentalDrivers
    // - Pending/Rejected: include minimal RentalBusAssignment so enrichment is possible
    let includeClause: any;

    if (normalizedStatus === 'Approved') {
      includeClause = {
        RentalBusAssignment: {
          select: {
            RentalBusAssignmentID: true,
            Battery: true,
            Lights: true,
            Oil: true,
            Water: true,
            Break: true,
            Air: true,
            Gas: true,
            Engine: true,
            TireCondition: true,
            Note: true,
            BusAssignment: true, // include all BusAssignment columns
            RentalDrivers: {
              select: {
                RentalDriverID: true,
                DriverID: true,
                CreatedAt: true,
              },
            },
          },
        },
      };
    } else if (normalizedStatus === 'Completed') {
      includeClause = {
        RentalBusAssignment: {
          // no `select` => return all scalar fields of RentalBusAssignment
          include: {
            BusAssignment: {
              select: {
                BusAssignmentID: true,
                BusID: true,
                Status: true,
              },
            },
            RentalDrivers: {
              select: {
                RentalDriverID: true,
                DriverID: true,
              },
            },
          },
        },
      };
    } else {
      includeClause = {
        RentalBusAssignment: {
          select: {
            RentalBusAssignmentID: true,
            BusAssignment: {
              select: {
                BusAssignmentID: true,
                BusID: true,
              },
            },
          },
        },
      };
    }

    const rentalRequests = await prisma.rentalRequest.findMany({
      where: whereClause,
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      include: includeClause,
    });

    // Fetch buses (prefer new source, fallback to stable)
    let buses: any[] = [];
    try {
      const nb = await fetchNewBuses();
      if (Array.isArray(nb) && nb.length > 0) buses = nb;
      else {
        const fb = await fetchBuses().catch(() => []);
        buses = Array.isArray(fb) ? fb : [];
      }
    } catch {
      buses = [];
    }

    const busMap = new Map<string, any>((buses ?? []).map((b: any) => [String(b.bus_id), b]));

    const enrichedRequests = (rentalRequests ?? []).map((rr: any) => {
      const rentalBusAssignment = rr.RentalBusAssignment as any | undefined;
      const busAssignment = rentalBusAssignment?.BusAssignment as any | undefined;
      const busID = busAssignment?.BusID ? String(busAssignment.BusID) : undefined;
      const busInfo = busID ? busMap.get(busID) : undefined;

      return {
        ...rr,
        BusType: busInfo?.bus_type ?? null,
        PlateNumber: busInfo?.plate_number ?? null,
        SeatCapacity: busInfo?.seat_capacity ?? null,
      };
    });

    const result = enrichedRequests.map((rr: any) => {
      const created = rr.CreatedAt instanceof Date ? rr.CreatedAt : rr.CreatedAt ? new Date(rr.CreatedAt) : null;
      const updated = rr.UpdatedAt instanceof Date ? rr.UpdatedAt : rr.UpdatedAt ? new Date(rr.UpdatedAt) : null;
      if (created && updated && created.getTime() === updated.getTime()) return { ...rr, UpdatedAt: null, UpdatedBy: null };
      return rr;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error fetching rental requests:', err);
    return NextResponse.json({ error: 'Failed to fetch rental requests' }, { status: 500 });
  }
};

const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();

    const {
      PickupLocation,
      DropoffLocation,
      DistanceKM,
      RentalPrice,
      NumberOfPassengers,
      RentalDate,
      Duration,
      CustomerName,
      CustomerContact,
      BusID,
      RouteID, // optional now; we'll look up a default if not provided
      rentalAssignment,
      Status,
      SpecialRequirements,
    } = body;

    if (
      !PickupLocation ||
      !DropoffLocation ||
      DistanceKM == null ||
      RentalPrice == null ||
      NumberOfPassengers == null ||
      !RentalDate ||
      Duration == null ||
      !CustomerName ||
      !CustomerContact ||
      !BusID
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let normalizedStatus = 'Pending' as RentalRequestStatus;
    if (Status) {
      const validStatuses = ['Pending', 'Approved', 'Rejected', 'Completed'];
      const found = validStatuses.find(s => s.toLowerCase() === String(Status).toLowerCase());
      if (!found) return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      normalizedStatus = found as RentalRequestStatus;
    }

    const parsedRentalDate = new Date(RentalDate);
    if (isNaN(parsedRentalDate.getTime())) {
      return NextResponse.json({ error: 'Invalid RentalDate' }, { status: 400 });
    }

    const actor = user?.userId ?? 'system';

    // Generate IDs before opening the transaction to avoid using the Prisma client
    // inside the transaction callback for unrelated queries (prevents P2028).
    const baID = await generateFormattedID('BA');
    const rrID = await generateFormattedID('RR');

    const created = await prisma.$transaction(async (tx) => {
      // determine route to use: prefer supplied RouteID, otherwise pick a route from DB (first created) or fallback '0'
      let routeIdToUse: string = String(RouteID ?? '');
      if (!routeIdToUse) {
        const defaultRoute = await tx.route.findFirst({ orderBy: { CreatedAt: 'asc' } });
        routeIdToUse = defaultRoute?.RouteID ?? '0';
      }

      await tx.busAssignment.create({
        data: {
          BusAssignmentID: baID,
          BusID: String(BusID),
          RouteID: routeIdToUse,
          AssignmentType: 'Rental',
          CreatedBy: actor,
        },
      });

      const rbaData: any = {
        RentalBusAssignmentID: baID,
        CreatedBy: actor,
      };
      if (rentalAssignment && typeof rentalAssignment === 'object' && 'Note' in rentalAssignment) {
        rbaData.Note = rentalAssignment.Note ?? null;
      }
      await tx.rentalBusAssignment.create({ data: rbaData });

      const rr = await tx.rentalRequest.create({
        data: {
          RentalRequestID: rrID,
          RentalBusAssignmentID: baID,
          PickupLocation: String(PickupLocation),
          DropoffLocation: String(DropoffLocation),
          DistanceKM: Number(DistanceKM),
          RentalPrice: Number(RentalPrice),
          NumberOfPassengers: Number(NumberOfPassengers),
          RentalDate: parsedRentalDate,
          Duration: Number(Duration),
          SpecialRequirements: SpecialRequirements ?? null,
          Status: normalizedStatus,
          CustomerName: String(CustomerName),
          CustomerContact: String(CustomerContact),
          CreatedBy: actor,
        },
        include: {
          RentalBusAssignment: {
            include: {
              BusAssignment: {
                select: {
                  BusAssignmentID: true,
                  BusID: true,
                  RouteID: true,
                  AssignmentType: true,
                  Status: true,
                },
              },
            },
          },
        },
      });

      return rr;
    });

    //try { await setCache(RENTAL_REQUESTS_CACHE_KEY, null); } catch {}

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('Error creating rental request:', err);
    // Log full error details for debugging
    try { console.error(JSON.stringify(err, Object.getOwnPropertyNames(err))); } catch {}
    return NextResponse.json({ error: 'Failed to create rental request' }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
