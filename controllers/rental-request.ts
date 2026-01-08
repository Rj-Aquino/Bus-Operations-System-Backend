import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { RentalRequestService } from '@/services/rental-request';
import { getCache, setCache, delCache, CACHE_KEYS } from '@/lib/cache';

const service = new RentalRequestService();

export class RentalRequestController {
  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const statusParam = url.searchParams.get('status') ?? undefined;

      const normalized = statusParam ? String(statusParam).toLowerCase() : null;
      const keyMap: Record<string, string | undefined> = {
        pending: CACHE_KEYS.RENTAL_REQUESTS_PENDING,
        approved: CACHE_KEYS.RENTAL_REQUESTS_APPROVED,
        rejected: CACHE_KEYS.RENTAL_REQUESTS_REJECTED,
        completed: CACHE_KEYS.RENTAL_REQUESTS_COMPLETED,
      };

      const cacheKey = normalized && keyMap[normalized]
        ? keyMap[normalized] as string
        : (CACHE_KEYS.RENTAL_REQUESTS_ALL ?? '');

      if (cacheKey) {
        const cached = await getCache<any[]>(cacheKey);
        if (cached) return NextResponse.json(cached, { status: 200 });
      }

      const result = await service.getRentalRequests(statusParam);

      if (cacheKey) await setCache(cacheKey, result);

      return NextResponse.json(result, { status: 200 });
    } catch (err) {
      console.error('GET_RENTAL_REQUEST_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch rental requests' }, { status: 500 });
    }
  }

  async handlePost(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      // ✅ CHANGE HERE
      const formData = await request.formData();

      // Convert FormData → plain object
      const body: any = {};
      formData.forEach((value, key) => {
        body[key] = value;
      });

      // IDImage will now be a File object
      const created = await service.createRentalRequest(body, user?.userId ?? null);
      await this.invalidateCaches();

      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      console.error('POST_RENTAL_REQUEST_ERROR', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to create rental request' },
        { status: 400 }
      );
    }
  }

  async handlePut(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const pathname = new URL(request.url).pathname;
      const RentalRequestID = pathname.split('/').pop();
      if (!RentalRequestID) return NextResponse.json({ error: 'RentalRequestID is required' }, { status: 400 });
      const body = await request.json();
      const updated = await service.updateRentalRequest(RentalRequestID, body, user?.userId ?? null);
      await this.invalidateCaches();
      return NextResponse.json(updated, { status: 200 });
    } catch (err) {
      console.error('PUT_RENTAL_REQUEST_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update rental request' }, { status: 400 });
    }
  }

  async handlePatch(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const pathname = new URL(request.url).pathname;
      const RentalRequestID = pathname.split('/').pop();
      if (!RentalRequestID) return NextResponse.json({ error: 'RentalRequestID is required' }, { status: 400 });
      const body = await request.json();
      if (typeof body.IsDeleted !== 'boolean') return NextResponse.json({ error: '`IsDeleted` must be boolean' }, { status: 400 });
      const res = await service.patchRentalRequestIsDeleted(RentalRequestID, body.IsDeleted, user?.userId ?? null);
      await this.invalidateCaches();
      return NextResponse.json(res, { status: 200 });
    } catch (err) {
      console.error('PATCH_RENTAL_REQUEST_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to patch rental request' }, { status: 400 });
    }
  }

  private async invalidateCaches(): Promise<void> {
    const keys = [
      CACHE_KEYS.RENTAL_REQUESTS_ALL,
      CACHE_KEYS.RENTAL_REQUESTS_PENDING,
      CACHE_KEYS.RENTAL_REQUESTS_APPROVED,
      CACHE_KEYS.RENTAL_REQUESTS_REJECTED,
      CACHE_KEYS.RENTAL_REQUESTS_COMPLETED,
      CACHE_KEYS.DASHBOARD ?? '',
      CACHE_KEYS.DAMAGE_REPORT_ALL ?? '',
      CACHE_KEYS.DAMAGE_REPORT_PENDING ?? '',
      CACHE_KEYS.DAMAGE_REPORT_ACCEPTED ?? '',
      CACHE_KEYS.DAMAGE_REPORT_REJECTED ?? '',
      CACHE_KEYS.DAMAGE_REPORT_NA ?? '',
    ].filter(Boolean) as string[];
    await Promise.all(keys.map(k => delCache(k)));
  }
}
