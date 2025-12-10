import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { RentalRequestService } from '@/services/rental-request';

const service = new RentalRequestService();

export class RentalRequestController {
  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const statusParam = url.searchParams.get('status') ?? undefined;
      const result = await service.getRentalRequests(statusParam);
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
      const body = await request.json();
      const created = await service.createRentalRequest(body, user?.userId ?? null);
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      console.error('POST_RENTAL_REQUEST_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create rental request' }, { status: 400 });
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
      return NextResponse.json(res, { status: 200 });
    } catch (err) {
      console.error('PATCH_RENTAL_REQUEST_ERROR', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to patch rental request' }, { status: 400 });
    }
  }
}