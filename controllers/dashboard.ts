import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { DashboardService } from '@/services/dashboard';
import { getCache, setCache, delCache, CACHE_KEYS } from '@/lib/cache';

export class DashboardController {
  private service = new DashboardService();
  private readonly CACHE_KEYS_TO_INVALIDATE = [CACHE_KEYS.DASHBOARD ?? ''];
  private CACHE_KEY = CACHE_KEYS.DASHBOARD ?? '';

  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    try {
      // Try cache first
      const cached = await getCache<any>(this.CACHE_KEY);
      if (cached) {
        return NextResponse.json(cached, { status: 200 });
      }

      // Fetch from service
      const dashboardData = await this.service.getDashboardData();

      // Cache result
      await setCache(this.CACHE_KEY, dashboardData);

      return NextResponse.json(dashboardData, { status: 200 });
    } catch (err) {
      console.error('GET_DASHBOARD_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  private async invalidateCaches(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_INVALIDATE.filter(key => key).map(key => delCache(key)));
  }
}