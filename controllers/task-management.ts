import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { delCache, getCache, setCache, CACHE_KEYS } from '@/lib/cache';
import { TaskManagementService} from '@/services/task-management';
import { TaskUpdateBody } from '@/services/task-management';

const service = new TaskManagementService();

export class TaskManagementController {
  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const { searchParams } = new URL(request.url);
      const filterStatus = searchParams.get('status');
      const filterPriority = searchParams.get('priority');
      const filterDamageID = searchParams.get('damageId');

      // Build cache key based on status and priority filters
      // Only cache if filterDamageID is not provided (since there's no cache key for damage-specific queries)
      let cacheKey = '';
      if (!filterDamageID) {
        if (filterStatus && filterPriority) {
          // Map status + priority combination to cache key
          const statusPriorityMap: Record<string, Record<string, string>> = {
            Pending: {
              Low: CACHE_KEYS.TASK_PENDING_LOW ?? '',
              Medium: CACHE_KEYS.TASK_PENDING_MEDIUM ?? '',
              High: CACHE_KEYS.TASK_PENDING_HIGH ?? '',
              Critical: CACHE_KEYS.TASK_PENDING_CRITICAL ?? '',
            },
            InProgress: {
              Low: CACHE_KEYS.TASK_INPROGRESS_LOW ?? '',
              Medium: CACHE_KEYS.TASK_INPROGRESS_MEDIUM ?? '',
              High: CACHE_KEYS.TASK_INPROGRESS_HIGH ?? '',
              Critical: CACHE_KEYS.TASK_INPROGRESS_CRITICAL ?? '',
            },
            Completed: {
              Low: CACHE_KEYS.TASK_COMPLETED_LOW ?? '',
              Medium: CACHE_KEYS.TASK_COMPLETED_MEDIUM ?? '',
              High: CACHE_KEYS.TASK_COMPLETED_HIGH ?? '',
              Critical: CACHE_KEYS.TASK_COMPLETED_CRITICAL ?? '',
            },
            Cancelled: {
              Low: CACHE_KEYS.TASK_CANCELLED_LOW ?? '',
              Medium: CACHE_KEYS.TASK_CANCELLED_MEDIUM ?? '',
              High: CACHE_KEYS.TASK_CANCELLED_HIGH ?? '',
              Critical: CACHE_KEYS.TASK_CANCELLED_CRITICAL ?? '',
            },
          };
          cacheKey = statusPriorityMap[filterStatus]?.[filterPriority] ?? '';
        } else if (filterStatus) {
          // Map status-only to cache key
          const statusMap: Record<string, string> = {
            Pending: CACHE_KEYS.TASK_PENDING ?? '',
            InProgress: CACHE_KEYS.TASK_INPROGRESS ?? '',
            Completed: CACHE_KEYS.TASK_COMPLETED ?? '',
            Cancelled: CACHE_KEYS.TASK_CANCELLED ?? '',
          };
          cacheKey = statusMap[filterStatus] ?? '';
        } else if (filterPriority) {
          // Map priority-only to cache key
          const priorityMap: Record<string, string> = {
            Low: CACHE_KEYS.TASK_LOW ?? '',
            Medium: CACHE_KEYS.TASK_MEDIUM ?? '',
            High: CACHE_KEYS.TASK_HIGH ?? '',
            Critical: CACHE_KEYS.TASK_CRITICAL ?? '',
          };
          cacheKey = priorityMap[filterPriority] ?? '';
        } else {
          // No filters → use ALL key
          cacheKey = CACHE_KEYS.TASK_ALL ?? '';
        }
      }

      // Check cache if key exists
      if (cacheKey) {
        const cached = await getCache<any[]>(cacheKey);
        if (cached) return NextResponse.json(cached, { status: 200 });
      }

      const formatted = await service.getMaintenanceWorksWithTasks(
        filterStatus,
        filterPriority,
        filterDamageID
      );

      // Cache result if key exists
      if (cacheKey) await setCache(cacheKey, formatted);

      return NextResponse.json(formatted, { status: 200 });
    } catch (err) {
      console.error('GET_MAINTENANCE_WORK_ERROR', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  async handlePut(request: NextRequest) {
    const { user, error } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status: 401 });

    // Extract MaintenanceWorkID from URL
    const pathname = request.nextUrl.pathname;
    const pathSegments = pathname.split('/').filter(Boolean);
    const maintenanceWorkId = pathSegments[pathSegments.length - 1];

    if (!maintenanceWorkId)
      return NextResponse.json(
        { error: 'MaintenanceWorkID is required in URL' },
        { status: 400 }
      );

    try {
      const body = (await request.json()) as { Tasks?: TaskUpdateBody[] };
      if (!body || !Array.isArray(body.Tasks))
        return NextResponse.json(
          { error: 'Request body must include Tasks array' },
          { status: 400 }
        );

      const updatedTasks = await service.updateTasksByMaintenanceWork(
        maintenanceWorkId,
        body.Tasks,
        user?.employeeId || null
      );

      await this.invalidateCaches();
      return NextResponse.json({ updatedTasks }, { status: 200 });
    } catch (err: any) {
      console.error('PUT_TASKS_BY_MAINTENANCE_ERROR', err);
      const message = err?.message ?? 'Internal server error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  private readonly CACHE_KEYS_TO_INVALIDATE = [
    // Task status keys (all variants)
    CACHE_KEYS.TASK_ALL ?? '',
    CACHE_KEYS.TASK_PENDING ?? '',
    CACHE_KEYS.TASK_INPROGRESS ?? '',
    CACHE_KEYS.TASK_COMPLETED ?? '',
    CACHE_KEYS.TASK_CANCELLED ?? '',
    // Task priority-only keys
    CACHE_KEYS.TASK_LOW ?? '',
    CACHE_KEYS.TASK_MEDIUM ?? '',
    CACHE_KEYS.TASK_HIGH ?? '',
    CACHE_KEYS.TASK_CRITICAL ?? '',
    // Task status + priority keys
    CACHE_KEYS.TASK_PENDING_LOW ?? '',
    CACHE_KEYS.TASK_PENDING_MEDIUM ?? '',
    CACHE_KEYS.TASK_PENDING_HIGH ?? '',
    CACHE_KEYS.TASK_PENDING_CRITICAL ?? '',
    CACHE_KEYS.TASK_INPROGRESS_LOW ?? '',
    CACHE_KEYS.TASK_INPROGRESS_MEDIUM ?? '',
    CACHE_KEYS.TASK_INPROGRESS_HIGH ?? '',
    CACHE_KEYS.TASK_INPROGRESS_CRITICAL ?? '',
    CACHE_KEYS.TASK_COMPLETED_LOW ?? '',
    CACHE_KEYS.TASK_COMPLETED_MEDIUM ?? '',
    CACHE_KEYS.TASK_COMPLETED_HIGH ?? '',
    CACHE_KEYS.TASK_COMPLETED_CRITICAL ?? '',
    CACHE_KEYS.TASK_CANCELLED_LOW ?? '',
    CACHE_KEYS.TASK_CANCELLED_MEDIUM ?? '',
    CACHE_KEYS.TASK_CANCELLED_HIGH ?? '',
    CACHE_KEYS.TASK_CANCELLED_CRITICAL ?? '',
    // Related maintenance work caches
    CACHE_KEYS.MAINTENANCE_ALL ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING_CRITICAL ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS_CRITICAL ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED_CRITICAL ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED_CRITICAL ?? '',
    CACHE_KEYS.MAINTENANCE_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_CRITICAL ?? '',
  ];

  private async invalidateCaches(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_INVALIDATE.filter(key => key).map(key => delCache(key)));
  }
}