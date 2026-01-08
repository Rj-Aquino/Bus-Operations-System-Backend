import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { BusAssignmentService } from '@/services/bus-assignment';
import { getCache, setCache, delCache, CACHE_KEYS } from '@/lib/cache';
import { PrismaClient } from '@prisma/client';

export class BusAssignmentController {
  private service = new BusAssignmentService();
  private readonly CACHE_KEYS_TO_INVALIDATE = [
    CACHE_KEYS.BUS_ASSIGNMENTS ?? '',
    CACHE_KEYS.DASHBOARD ?? '',
    CACHE_KEYS.BUS_OPERATIONS_NOTREADY ?? '',
    CACHE_KEYS.BUS_OPERATIONS_NOTSTARTED ?? '',
    CACHE_KEYS.BUS_OPERATIONS_INOPERATION ?? '',
    CACHE_KEYS.BUS_OPERATIONS_ALL ?? '',
  ];

  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      // Check cache
      const cacheKey = CACHE_KEYS.BUS_ASSIGNMENTS ?? '';
      const cached = await getCache<any[]>(cacheKey);
      if (cached) {
        const processed = this.processAssignments(cached);
        return NextResponse.json(processed, { status: 200 });
      }

      // Fetch from DB
      const assignments = await this.fetchAssignmentsFromDB();
      const processed = this.processAssignments(assignments);

      // Cache result
      await setCache(cacheKey, processed);

      return NextResponse.json(processed, { status: 200 });
    } catch (err) {
      console.error('GET_ASSIGNMENTS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch assignments';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handlePost(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const data = await request.json();
      const actor = user?.employeeId || null;

      const result = await this.service.createBusAssignment(data, actor);
      await this.invalidateCaches();
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      console.error('CREATE_ASSIGNMENT_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to create bus assignment';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  async handlePut(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const busAssignmentId = url.pathname.split('/').pop();
      if (!busAssignmentId) {
        return NextResponse.json({ error: 'BusAssignmentID is required' }, { status: 400 });
      }

      const data = await request.json();
      const actor = user?.employeeId || null;

      const result = await this.service.updateBusAssignment(busAssignmentId, data, actor);
      await this.invalidateCaches();
      return NextResponse.json(result, { status: 200 });
    } catch (err) {
      console.error('UPDATE_ASSIGNMENT_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to update bus assignment';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  async handlePatch(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const busAssignmentId = url.pathname.split('/').pop();
      if (!busAssignmentId) {
        return NextResponse.json({ error: 'BusAssignmentID is required' }, { status: 400 });
      }

      const body = await request.json();
      const { IsDeleted } = body;
      if (typeof IsDeleted !== 'boolean') {
        return NextResponse.json({ error: '`IsDeleted` must be a boolean' }, { status: 400 });
      }

      const actor = user?.employeeId || null;
      await this.service.softDeleteBusAssignment(busAssignmentId, actor);
      await this.invalidateCaches();

      return NextResponse.json({ IsDeleted: true, UpdatedBy: actor }, { status: 200 });
    } catch (err) {
      console.error('PATCH_ASSIGNMENT_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to delete bus assignment';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  private async invalidateCaches(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_INVALIDATE.filter(key => key).map(key => delCache(key)));
  }

  private processAssignments(assignments: any[]): any[] {
    return assignments.map(item => {
      let processed: any = item;

      // RegularBusAssignment: clear UpdatedAt/UpdatedBy if never updated
      if (
        item.CreatedAt &&
        item.UpdatedAt &&
        new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()
      ) {
        processed = { ...processed, UpdatedAt: null, UpdatedBy: null };
      }

      // BusAssignment: same logic
      if (
        item.BusAssignment?.CreatedAt &&
        item.BusAssignment?.UpdatedAt &&
        new Date(item.BusAssignment.CreatedAt).getTime() === new Date(item.BusAssignment.UpdatedAt).getTime()
      ) {
        processed.BusAssignment = { ...processed.BusAssignment, UpdatedAt: null, UpdatedBy: null };
      }

      // Route: same logic
      if (
        item.BusAssignment?.Route?.CreatedAt &&
        item.BusAssignment?.Route?.UpdatedAt &&
        new Date(item.BusAssignment.Route.CreatedAt).getTime() === new Date(item.BusAssignment.Route.UpdatedAt).getTime()
      ) {
        processed.BusAssignment.Route = { ...processed.BusAssignment.Route, UpdatedAt: null, UpdatedBy: null };
      }

      return processed;
    });
  }

  private async fetchAssignmentsFromDB(): Promise<any[]> {

    const prisma = new PrismaClient();
    return prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: { IsDeleted: false },
      },
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
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
        BusTrips: {
          select: {
            BusTripID: true,
            DispatchedAt: true,
            CompletedAt: true,
            PettyCash: true,
            Sales: true,
            TripExpense: true,
            Payment_Method: true,
            CreatedAt: true,
            UpdatedAt: true,
          },
        },
        BusAssignment: {
          select: {
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
  }
}