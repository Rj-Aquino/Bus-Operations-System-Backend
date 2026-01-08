import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { delCache, CACHE_KEYS } from '@/lib/cache';
import { StopsService } from '@/services/stops';

const service = new StopsService();

export class StopsController {
  async handleGet(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const data = await service.getStopsCached();
      return NextResponse.json(data, { status: 200 });
    } catch (err) {
      console.error('GET_STOPS_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch stops' }, { status: 500 });
    }
  }

  async handlePost(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const body = await req.json();
      const { StopName, latitude, longitude } = body ?? {};
      if (typeof StopName !== 'string' || typeof latitude !== 'string' || typeof longitude !== 'string') {
        return NextResponse.json({ error: 'Invalid input. All fields must be non-empty strings.' }, { status: 400 });
      }

      // generate ID if you rely on generator in route currently
      const created = await service.createStop({ StopName, latitude, longitude }, user?.employeeId || null);
      await this.invalidateCaches();
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      console.error('POST_STOPS_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create stop' }, { status: 500 });
    }
  }

  async handlePut(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const url = new URL(req.url);
      const StopID = url.pathname.split('/').pop();
      if (!StopID) return NextResponse.json({ error: 'StopID is required in the URL.' }, { status: 400 });

      const body = await req.json();
      const updated = await service.updateStop(StopID, body, user?.employeeId || null);
      await this.invalidateCaches();
      return NextResponse.json(updated, { status: 200 });
    } catch (err) {
      console.error('PUT_STOP_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update stop' }, { status: 400 });
    }
  }

  async handlePatch(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const url = new URL(req.url);
      const StopID = url.pathname.split('/').pop();
      if (!StopID) return NextResponse.json({ error: 'StopID is required in the URL.' }, { status: 400 });

      const body = await req.json();
      if (typeof body.IsDeleted !== 'boolean') return NextResponse.json({ error: '`IsDeleted` must be a boolean.' }, { status: 400 });

      const updated = await service.patchStopIsDeleted(StopID, body.IsDeleted, user?.employeeId || null);
      await this.invalidateCaches();
      return NextResponse.json(updated, { status: 200 });
    } catch (err) {
      console.error('PATCH_STOP_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update stop' }, { status: 400 });
    }
  }

  private readonly CACHE_KEYS_TO_INVALIDATE = [
    CACHE_KEYS.STOPS_LIST ?? '',
    CACHE_KEYS.ROUTES ?? '',
    CACHE_KEYS.ROUTES_FULL ?? '',
    CACHE_KEYS.DASHBOARD ?? '',
  ];

  private async invalidateCaches(): Promise<void> {
    await Promise.all(this.CACHE_KEYS_TO_INVALIDATE.filter(key => key).map(key => delCache(key)));
  }
}