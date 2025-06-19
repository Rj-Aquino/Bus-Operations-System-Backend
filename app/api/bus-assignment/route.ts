import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';
import { getCache, setCache, delCache, CACHE_KEYS} from '@/lib/cache';

const ASSIGNMENTS_CACHE_KEY = CACHE_KEYS.BUS_ASSIGNMENTS ?? '';

const gethandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // 1. Check cache
  const cached = await getCache<any[]>(ASSIGNMENTS_CACHE_KEY);
  if (cached) {
    // Apply UpdatedAt/UpdatedBy logic to cached data
    const processed = cached.map(item => {
      let processedItem: any = item;
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        processedItem = { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return processedItem;
    });
    return NextResponse.json(processed, { status: 200 });
  }

  // 2. Fetch from Prisma
  try {
    const assignments = await prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: {
          IsDeleted: false,
        },
      },
      orderBy: [
        { UpdatedAt: 'desc' },
        { CreatedAt: 'desc' },
      ],
      select: {
        RegularBusAssignmentID: true,
        DriverID: true,
        ConductorID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        QuotaPolicies: {
          select: {
            QuotaPolicyID: true,
            StartDate: true,
            EndDate: true,
            Fixed: { select: { Quota: true } },
            Percentage: { select: { Percentage: true } },
          },
        },
        BusAssignment: {
          select: {
            IsDeleted: true,
            BusID: true,
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
          },
        },
      },
    });

    // Apply UpdatedAt/UpdatedBy logic before caching and returning
    const processed = assignments.map(item => {
      let processedItem: any = item;
      // For RegularBusAssignment
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        processedItem = { ...processedItem, UpdatedAt: null, UpdatedBy: null };
      }
      // For BusAssignment
      if (
        item.BusAssignment &&
        item.BusAssignment.CreatedAt &&
        item.BusAssignment.UpdatedAt &&
        new Date(item.BusAssignment.CreatedAt).getTime() === new Date(item.BusAssignment.UpdatedAt).getTime()
      ) {
        processedItem.BusAssignment = {
          ...processedItem.BusAssignment,
          UpdatedAt: null,
          UpdatedBy: null,
        };
      }
      // For Route
      if (
        item.BusAssignment &&
        item.BusAssignment.Route &&
        item.BusAssignment.Route.CreatedAt &&
        item.BusAssignment.Route.UpdatedAt &&
        new Date(item.BusAssignment.Route.CreatedAt).getTime() === new Date(item.BusAssignment.Route.UpdatedAt).getTime()
      ) {
        processedItem.BusAssignment.Route = {
          ...processedItem.BusAssignment.Route,
          UpdatedAt: null,
          UpdatedBy: null,
        };
      }
      return processedItem;
    });

    // 3. Cache the result
    await setCache(ASSIGNMENTS_CACHE_KEY, processed);

    return NextResponse.json(processed, { status: 200 });
  } catch (error) {
    console.error('REGULAR_ASSIGNMENTS_ERROR', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
};

const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const data = await request.json();
    console.log('Received data (POST /bus-assignment):', data);

    // 1. BusID must not already be assigned (not deleted)
    const existingBus = await prisma.busAssignment.findFirst({
      where: { BusID: data.BusID, IsDeleted: false }
    });
    if (existingBus) {
      return NextResponse.json({ error: 'Bus is already assigned.' }, { status: 400 });
    }

    // 2. DriverID must not already be assigned (not deleted)
    const existingDriver = await prisma.regularBusAssignment.findFirst({
      where: {
        DriverID: data.DriverID,
        BusAssignment: { IsDeleted: false }
      }
    });
    if (existingDriver) {
      return NextResponse.json({ error: 'Driver is already assigned.' }, { status: 400 });
    }

    // 3. ConductorID must not already be assigned (not deleted)
    const existingConductor = await prisma.regularBusAssignment.findFirst({
      where: {
        ConductorID: data.ConductorID,
        BusAssignment: { IsDeleted: false }
      }
    });
    if (existingConductor) {
      return NextResponse.json({ error: 'Conductor is already assigned.' }, { status: 400 });
    }

    // 4. QuotaPolicy Date Overlap Validation
    if (Array.isArray(data.QuotaPolicy)) {
      type QuotaPolicyInput = { startDate?: string; StartDate?: string; endDate?: string; EndDate?: string; [key: string]: any };
      const sorted = (data.QuotaPolicy as QuotaPolicyInput[])
        .map((qp: QuotaPolicyInput) => {
          if (!(qp.startDate || qp.StartDate) || !(qp.endDate || qp.EndDate)) {
            throw new Error('All QuotaPolicy entries must have both startDate and endDate.');
          }
          return {
            start: new Date(qp.startDate || qp.StartDate as string),
            end: new Date(qp.endDate || qp.EndDate as string),
          };
        })

      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end > sorted[i + 1].start) {
          return NextResponse.json(
            { error: 'QuotaPolicy date ranges cannot overlap.' },
            { status: 400 }
          );
        }
      }
    }

    const busAssignmentID = generateFormattedID('BA');

    await prisma.$transaction(async (tx) => {
      // 1. Create BusAssignment with RegularBusAssignment (1:1 via ID)
      await tx.busAssignment.create({
        data: {
          BusAssignmentID: busAssignmentID,
          BusID: data.BusID,
          RouteID: data.RouteID,
          Status: "NotReady",
          CreatedBy: user?.employeeId || null,
          RegularBusAssignment: {
            create: {
              DriverID: data.DriverID,
              ConductorID: data.ConductorID,
              CreatedBy: user?.employeeId || null,
            },
          },
        },
      });

      // 2. Create all QuotaPolicies for this RegularBusAssignment
      for (const qp of data.QuotaPolicy) {
        const quotaPolicyID = generateFormattedID('QP');

        // Set StartDate as usual
        const startDate = qp.startDate ? new Date(qp.startDate) : undefined;
        // Set EndDate to end of day if provided
        const endDate = qp.endDate ? new Date(qp.endDate) : undefined;
        if (endDate) {
          endDate.setHours(23, 59, 59, 999);
        }

        const quotaPolicyData: any = {
          QuotaPolicyID: quotaPolicyID,
          RegularBusAssignmentID: busAssignmentID,
          ...(startDate && { StartDate: startDate }),
          ...(endDate && { EndDate: endDate }),
          CreatedBy: user?.employeeId || null,
        };

        if (qp.type && qp.type.toUpperCase() === 'FIXED') {
          quotaPolicyData.Fixed = {
            create: {
              Quota: qp.value,
              CreatedBy: user?.employeeId || null,
            },
          };
        } else if (qp.type && qp.type.toUpperCase() === 'PERCENTAGE') {
          quotaPolicyData.Percentage = {
            create: {
              Percentage: qp.value,
              CreatedBy: user?.employeeId || null,
            },
          };
        }

        await tx.quota_Policy.create({
          data: quotaPolicyData,
        });
      }
    }, { timeout: 10_000 });

    // 3. Fetch result after transaction
    const result = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID: busAssignmentID },
      select: {
        BusAssignmentID: true,
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
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

    await delCache(ASSIGNMENTS_CACHE_KEY);
    await delCache(CACHE_KEYS.BUSES ?? '');
    await delCache(CACHE_KEYS.DRIVERS ?? '');
    await delCache(CACHE_KEYS.CONDUCTORS ?? '');
    await delCache(CACHE_KEYS.DASHBOARD ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_NOTREADY ?? '');
    await delCache(CACHE_KEYS.BUS_OPERATIONS_ALL ?? '');

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('CREATE_ASSIGNMENT_ERROR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create BusAssignment' },
      { status: 500 }
    );
  }
};

export const GET = withCors(gethandler);
export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));