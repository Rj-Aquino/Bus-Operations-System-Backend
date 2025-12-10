import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { MaintenanceWorkService } from '@/services/maintenance-work';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

export class MaintenanceWorkController {
  private service = new MaintenanceWorkService();
//   private CACHE_KEY = CACHE_KEYS.MAINTENANCE_WORK ?? '';

  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const filterStatus = url.searchParams.get('status');
      const filterPriority = url.searchParams.get('priority');

      // Build cache key with filters
        //   const cacheKey = filterStatus || filterPriority
        //     ? `${this.CACHE_KEY}_${filterStatus ?? 'all'}_${filterPriority ?? 'all'}`
        //     : this.CACHE_KEY;

      // Try cache
        //   const cached = await getCache<any[]>(cacheKey);
        //   if (cached) {
        //     return NextResponse.json(cached, { status: 200 });
        //   }

      // Fetch from service
      const works = await this.service.getMaintenanceWorks(filterStatus, filterPriority);

      // Cache result
        //   await setCache(cacheKey, works);

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

      return NextResponse.json({ updated: result }, { status: 200 });
    } catch (err) {
      console.error('PUT_MAINTENANCE_WORK_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to update maintenance work';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
}