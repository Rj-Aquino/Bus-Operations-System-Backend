import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { PerformanceReportService } from '@/services/performance-report';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

export class PerformanceReportController {
  private service = new PerformanceReportService();
//   private CACHE_KEY = CACHE_KEYS.PERFORMANCE_REPORT ?? '';

  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const days = Number(url.searchParams.get('days')) || 30;
      const busType = url.searchParams.get('busType') || 'all';
      const route = url.searchParams.get('route') || 'all';

      // Validate days parameter
      if (isNaN(days) || days < 1) {
        return NextResponse.json({ error: 'days must be a positive number' }, { status: 400 });
      }

      // Build cache key with filters
        //   const cacheKey = `${this.CACHE_KEY}_${days}_${busType}_${route}`;

      // Try cache
        //   const cached = await getCache<any>(cacheKey);
        //   if (cached) {
        //     return NextResponse.json(cached, { status: 200 });
        //   }

      // Fetch from service
      const report = await this.service.getPerformanceReport(days, busType, route);

      // Cache result (1 hour TTL for expensive queries)
        //   await setCache(cacheKey, report, 3600);

      return NextResponse.json(report, { status: 200 });
    } catch (err) {
      console.error('GET_PERFORMANCE_REPORT_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to generate performance report';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}