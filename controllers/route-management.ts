import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { RouteManagementService } from '@/services/route-management';

const service = new RouteManagementService();

export class RouteManagementController {
  async handleGet(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const data = await service.getSummaryCached();
      return NextResponse.json(data, { status: 200 });
    } catch (err) {
      console.error('GET_ROUTE_SUMMARY_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch routes' }, { status: 500 });
    }
  }

  async handleGetFull(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const data = await service.getFullCached();
      return NextResponse.json(data, { status: 200 });
    } catch (err) {
      console.error('GET_ROUTE_FULL_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch full routes' }, { status: 500 });
    }
  }

  async handlePost(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const body = await req.json();
      const created = await service.createRoute(body, user?.employeeId || null);
      return NextResponse.json(created, { status: 201 });
    } catch (err: any) {
      console.error('POST_ROUTE_ERROR', err);
      const msg = err?.message || 'Failed to create route';
      const code = err?.code === 'P2002' ? 400 : 400;
      return NextResponse.json({ error: msg }, { status: code });
    }
  }

  async handlePut(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const url = new URL(req.url);
      const RouteID = url.pathname.split('/').pop();
      if (!RouteID) return NextResponse.json({ error: 'RouteID is required in the URL path.' }, { status: 400 });
      const body = await req.json();
      const updated = await service.updateRoute(RouteID, body, user?.employeeId || null);
      return NextResponse.json(updated, { status: 200 });
    } catch (err) {
      console.error('PUT_ROUTE_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update route' }, { status: 400 });
    }
  }

  async handlePatch(req: NextRequest) {
    const { user, error, status } = await authenticateRequest(req);
    if (error) return NextResponse.json({ error }, { status });
    try {
      const url = new URL(req.url);
      const RouteID = url.pathname.split('/').pop();
      if (!RouteID) return NextResponse.json({ error: 'RouteID is required in the URL path.' }, { status: 400 });
      const body = await req.json();
      if (typeof body.IsDeleted !== 'boolean') return NextResponse.json({ error: 'Invalid isDeleted value. It must be a boolean.' }, { status: 400 });
      const updated = await service.patchRouteIsDeleted(RouteID, body.IsDeleted, user?.employeeId || null);
      return NextResponse.json(updated, { status: 200 });
    } catch (err) {
      console.error('PATCH_ROUTE_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update route' }, { status: 400 });
    }
  }
}