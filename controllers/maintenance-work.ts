import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { MaintenanceWorkService } from '@/services/maintenance-work';
import { getCache, setCache, delCache, CACHE_KEYS } from '@/lib/cache';

export class MaintenanceWorkController {
  private service = new MaintenanceWorkService();
  private readonly CACHE_KEYS_TO_INVALIDATE = [
    // Status-only keys
    CACHE_KEYS.MAINTENANCE_ALL ?? '',
    CACHE_KEYS.MAINTENANCE_PENDING ?? '',
    CACHE_KEYS.MAINTENANCE_INPROGRESS ?? '',
    CACHE_KEYS.MAINTENANCE_COMPLETED ?? '',
    CACHE_KEYS.MAINTENANCE_CANCELLED ?? '',
    // Priority-only keys
    CACHE_KEYS.MAINTENANCE_LOW ?? '',
    CACHE_KEYS.MAINTENANCE_MEDIUM ?? '',
    CACHE_KEYS.MAINTENANCE_HIGH ?? '',
    CACHE_KEYS.MAINTENANCE_CRITICAL ?? '',
    // Status + Priority keys
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
  ];
  private CACHE_KEY = CACHE_KEYS.MAINTENANCE_ALL ?? '';

  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const filterStatus = url.searchParams.get('status');
      const filterPriority = url.searchParams.get('priority');

      // Build cache key based on status and priority filters
      let cacheKey = '';
      if (filterStatus && filterPriority) {
        // Map status + priority combination to cache key
        const statusPriorityMap: Record<string, Record<string, string | undefined>> = {
          Pending: {
            Low: CACHE_KEYS.MAINTENANCE_PENDING_LOW,
            Medium: CACHE_KEYS.MAINTENANCE_PENDING_MEDIUM,
            High: CACHE_KEYS.MAINTENANCE_PENDING_HIGH,
            Critical: CACHE_KEYS.MAINTENANCE_PENDING_CRITICAL,
          },
          InProgress: {
            Low: CACHE_KEYS.MAINTENANCE_INPROGRESS_LOW,
            Medium: CACHE_KEYS.MAINTENANCE_INPROGRESS_MEDIUM,
            High: CACHE_KEYS.MAINTENANCE_INPROGRESS_HIGH,
            Critical: CACHE_KEYS.MAINTENANCE_INPROGRESS_CRITICAL,
          },
          Completed: {
            Low: CACHE_KEYS.MAINTENANCE_COMPLETED_LOW,
            Medium: CACHE_KEYS.MAINTENANCE_COMPLETED_MEDIUM,
            High: CACHE_KEYS.MAINTENANCE_COMPLETED_HIGH,
            Critical: CACHE_KEYS.MAINTENANCE_COMPLETED_CRITICAL,
          },
          Cancelled: {
            Low: CACHE_KEYS.MAINTENANCE_CANCELLED_LOW,
            Medium: CACHE_KEYS.MAINTENANCE_CANCELLED_MEDIUM,
            High: CACHE_KEYS.MAINTENANCE_CANCELLED_HIGH,
            Critical: CACHE_KEYS.MAINTENANCE_CANCELLED_CRITICAL,
          },
        };
        cacheKey = statusPriorityMap[filterStatus]?.[filterPriority] ?? '';
      } else if (filterStatus) {
        // Map status-only to cache key
        const statusMap: Record<string, string | undefined> = {
          Pending: CACHE_KEYS.MAINTENANCE_PENDING,
          InProgress: CACHE_KEYS.MAINTENANCE_INPROGRESS,
          Completed: CACHE_KEYS.MAINTENANCE_COMPLETED,
          Cancelled: CACHE_KEYS.MAINTENANCE_CANCELLED,
        };
        cacheKey = statusMap[filterStatus] ?? '';
      } else if (filterPriority) {
        // Map priority-only to cache key
        const priorityMap: Record<string, string | undefined> = {
          Low: CACHE_KEYS.MAINTENANCE_LOW,
          Medium: CACHE_KEYS.MAINTENANCE_MEDIUM,
          High: CACHE_KEYS.MAINTENANCE_HIGH,
          Critical: CACHE_KEYS.MAINTENANCE_CRITICAL,
        };
        cacheKey = priorityMap[filterPriority] ?? '';
      } else {
        // No filters → use ALL key
        cacheKey = CACHE_KEYS.MAINTENANCE_ALL ?? '';
      }

      // Try cache
      if (cacheKey) {
        const cached = await getCache<any[]>(cacheKey);
        if (cached) {
          return NextResponse.json(cached, { status: 200 });
        }
      }

      // Fetch from service
      const works = await this.service.getMaintenanceWorks(filterStatus, filterPriority);

      // Cache result
      if (cacheKey) await setCache(cacheKey, works);

      return NextResponse.json(works, { status: 200 });
    } catch (err) {
      console.error('GET_MAINTENANCE_WORK_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch maintenance works';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handlePut(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const maintenanceWorkID = url.pathname.split('/').pop();

      if (!maintenanceWorkID) {
        return NextResponse.json(
          { error: 'MaintenanceWorkID is required in the URL' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const actor = user?.employeeId || null;

      const result = await this.service.updateMaintenanceWork(maintenanceWorkID, body, actor);
      await this.invalidateCaches();

      return NextResponse.json({ updated: result }, { status: 200 });
    } catch (err) {
      console.error('PUT_MAINTENANCE_WORK_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to update maintenance work';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

    private async invalidateCaches(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_INVALIDATE.filter(key => key).map(key => delCache(key)));
  }
}
