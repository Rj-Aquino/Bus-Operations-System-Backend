import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DamageReportService } from '@/services/damage-report';
import { getCache, setCache, delCache, CACHE_KEYS } from '@/lib/cache';

export class DamageReportController {
  private service = new DamageReportService();
  private readonly CACHE_KEYS_TO_INVALIDATE = [
    CACHE_KEYS.DAMAGE_REPORT_ALL ?? '',
    CACHE_KEYS.DAMAGE_REPORT_PENDING ?? '',
    CACHE_KEYS.DAMAGE_REPORT_ACCEPTED ?? '',
    CACHE_KEYS.DAMAGE_REPORT_REJECTED ?? '',
    CACHE_KEYS.DAMAGE_REPORT_NA ?? '',
  ];

  async handleGet(request: NextRequest) {
    try {
      const url = new URL(request.url);
      const filterStatus = url.searchParams.get('status');

      // Map status filter to proper cache key
      let cacheKey = '';
      if (filterStatus) {
        const statusMap: Record<string, string | undefined> = {
          Pending: CACHE_KEYS.DAMAGE_REPORT_PENDING,
          Accepted: CACHE_KEYS.DAMAGE_REPORT_ACCEPTED,
          Rejected: CACHE_KEYS.DAMAGE_REPORT_REJECTED,
          NA: CACHE_KEYS.DAMAGE_REPORT_NA,
        };
        cacheKey = statusMap[filterStatus] ?? '';
      } else {
        cacheKey = CACHE_KEYS.DAMAGE_REPORT_ALL ?? '';
      }

      // Try cache
      if (cacheKey) {
        const cached = await getCache<any[]>(cacheKey);
        if (cached) {
          return NextResponse.json(cached, { status: 200 });
        }
      }

      // Fetch from service
      const result = await this.service.getDamageReports(filterStatus);

      // Cache result
      if (cacheKey) await setCache(cacheKey, result);

      return NextResponse.json(result, { status: 200 });
    } catch (err) {
      console.error('GET_DAMAGE_REPORTS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch damage reports';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handlePatch(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const damageReportID = url.pathname.split('/').pop();

      if (!damageReportID) {
        return NextResponse.json(
          { error: 'DamageReportID is required in the URL' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { status: newStatus } = body ?? {};

      if (typeof newStatus !== 'string') {
        return NextResponse.json(
          { error: 'Invalid request body. Expecting { status }' },
          { status: 400 }
        );
      }

      const actor = user?.employeeId || null;
      const result = await this.service.updateDamageReportStatus(damageReportID, newStatus, actor);
      await this.invalidateCaches();

      return NextResponse.json({ updated: result }, { status: 200 });
    } catch (err) {
      console.error('PATCH_DAMAGE_REPORT_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to update damage report';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  private async invalidateCaches(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_INVALIDATE.filter(key => key).map(key => delCache(key)));
  }
}