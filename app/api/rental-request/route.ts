import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { RentalRequestStatus } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';
import { generateFormattedID } from '@/lib/idGenerator';
import { fetchBuses, fetchNewBuses } from '@/lib/fetchExternal';

const RENTAL_REQUESTS_CACHE_KEY = CACHE_KEYS.RENTAL_REQUESTS_ALL ?? '';

const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");

    const whereClause: { Status?: any; IsDeleted?: boolean } = { IsDeleted: false };

    let normalizedStatus: string | undefined;
    if (statusParam) {
      const validStatuses = ["Pending", "Approved", "Rejected", "Completed"];
      normalizedStatus = validStatuses.find(
        (s) => s.toLowerCase() === statusParam.toLowerCase()
      );
      if (!normalizedStatus)
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      whereClause.Status = normalizedStatus;
    }

      let includeClause: any;

      if (normalizedStatus === "Approved") {
        includeClause = {
          RentalBusAssignment: {
            include: {
              BusAssignment: {
                include: {
                  DamageReports: {
                    orderBy: { CheckDate: "desc" },
                    take: 1,
                  },
                },
              },
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
      } else if (normalizedStatus === "Completed") {
        includeClause = {
          RentalBusAssignment: {
            include: {
              BusAssignment: {
                include: {
                  DamageReports: {
                    orderBy: { CheckDate: "desc" },
                    take: 1,
                  },
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
        // Pending / Rejected
        includeClause = {
          RentalBusAssignment: {
            include: {
              BusAssignment: true, // just get BusAssignment link (scalars + relations)
            },
          },
        };
      }

    // ✅ Fetch rental requests
    const rentalRequests = await prisma.rentalRequest.findMany({
      where: whereClause,
      orderBy: [{ UpdatedAt: "desc" }, { CreatedAt: "desc" }],
      include: includeClause,
    });

    // ✅ Fetch buses (try new → fallback)
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

    const busMap = new Map<string, any>(
      (buses ?? []).map((b: any) => [String(b.bus_id), b])
    );

    // ✅ Enrich with bus info
    const enrichedRequests = (rentalRequests ?? []).map((rr: any) => {
      const rentalBusAssignment = rr.RentalBusAssignment;
      const busAssignment = rentalBusAssignment?.BusAssignment;
      const busID = busAssignment?.BusID ? String(busAssignment.BusID) : undefined;
      const busInfo = busID ? busMap.get(busID) : undefined;

      return {
        ...rr,
        BusType: busInfo?.bus_type ?? null,
        PlateNumber: busInfo?.plate_number ?? null,
        SeatCapacity: busInfo?.seat_capacity ?? null,
      };
    });

    // ✅ Normalize timestamps
    const result = enrichedRequests.map((rr: any) => {
      const created =
        rr.CreatedAt instanceof Date
          ? rr.CreatedAt
          : rr.CreatedAt
          ? new Date(rr.CreatedAt)
          : null;
      const updated =
        rr.UpdatedAt instanceof Date
          ? rr.UpdatedAt
          : rr.UpdatedAt
          ? new Date(rr.UpdatedAt)
          : null;
      if (created && updated && created.getTime() === updated.getTime())
        return { ...rr, UpdatedAt: null, UpdatedBy: null };
      return rr;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error fetching rental requests:", err);
    return NextResponse.json({ error: "Failed to fetch rental requests" }, { status: 500 });
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
      TotalRentalAmount,
      NumberOfPassengers,
      RentalDate,
      Duration,
      CustomerName,
      CustomerContact,
      BusID,
      RouteName, // ✅ now required instead of RouteID
      Status,
      SpecialRequirements,
    } = body;

    // ✅ validate required fields based on schema
    if (
      !PickupLocation ||
      !DropoffLocation ||
      DistanceKM == null ||
      TotalRentalAmount == null ||
      NumberOfPassengers == null ||
      !RentalDate ||
      Duration == null ||
      !CustomerName ||
      !CustomerContact ||
      !BusID ||
      !RouteName
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ✅ normalize status
    let normalizedStatus = "Pending" as RentalRequestStatus;
    if (Status) {
      const validStatuses = ["Pending", "Approved", "Rejected", "Completed"];
      const found = validStatuses.find(
        (s) => s.toLowerCase() === String(Status).toLowerCase()
      );
      if (!found)
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      normalizedStatus = found as RentalRequestStatus;
    }

    // ✅ parse and validate date
    const parsedRentalDate = new Date(RentalDate);
    if (isNaN(parsedRentalDate.getTime())) {
      return NextResponse.json({ error: "Invalid RentalDate" }, { status: 400 });
    }

    const actor = user?.userId ?? "system";

    const baID = await generateFormattedID("BA");
    const rrID = await generateFormattedID("RR");

    // ✅ perform transaction
    const created = await prisma.$transaction(async (tx) => {
      // create BusAssignment (no RouteID anymore)
      await tx.busAssignment.create({
        data: {
          BusAssignmentID: baID,
          BusID: String(BusID),
          AssignmentType: "Rental",
          CreatedBy: actor,
        },
      });

      // create RentalBusAssignment
      await tx.rentalBusAssignment.create({
        data: {
          RentalBusAssignmentID: baID,
          CreatedBy: actor,
        },
      });

      // create RentalRequest (RouteName provided by user)
      const rr = await tx.rentalRequest.create({
        data: {
          RentalRequestID: rrID,
          RentalBusAssignmentID: baID,
          RouteName: String(RouteName), // ✅ now required from body
          PickupLocation: String(PickupLocation),
          DropoffLocation: String(DropoffLocation),
          DistanceKM: Number(DistanceKM),
          TotalRentalAmount: Number(TotalRentalAmount),
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

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Error creating rental request:", err);
    try {
      console.error(JSON.stringify(err, Object.getOwnPropertyNames(err)));
    } catch {}
    return NextResponse.json({ error: "Failed to create rental request" }, { status: 500 });
  }
};

export const GET = withCors(getHandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
