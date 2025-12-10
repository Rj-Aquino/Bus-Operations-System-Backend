import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { TicketTypesService } from '@/services/ticket-types';

const service = new TicketTypesService();

export class TicketTypesController {
  async handleGet(request: NextRequest): Promise<NextResponse> {
    const { user, error, status } = await authenticateRequest(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    try {
      const ticketTypes = await service.getTicketTypes();
      return NextResponse.json(ticketTypes, { status: 200 });
    } catch (err) {
      console.error('GET_TICKET_TYPES_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch ticket types';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}