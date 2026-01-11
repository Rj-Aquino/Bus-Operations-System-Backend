import prisma from '@/client';
import { getCache, setCache, delCache, CACHE_KEYS } from '@/lib/cache';

const TICKET_TYPES_CACHE_KEY = CACHE_KEYS.TICKET_TYPES ?? '';

export class TicketTypesService {
  async getTicketTypes(): Promise<Array<{ TicketTypeID: string; Value: number }>> {
    // Try cache first
    const cached = await getCache<Array<{ TicketTypeID: string; Value: number }>>(
      TICKET_TYPES_CACHE_KEY
    );
    if (cached) {
      return cached;
    }

    // Fetch from database
    const ticketTypes = await prisma.ticketType.findMany({
      select: {
        TicketTypeID: true,
        Value: true,
      },
      orderBy: { TicketTypeID: 'asc' },
    });

    // Cache result
    await setCache(TICKET_TYPES_CACHE_KEY, ticketTypes);

    return ticketTypes;
  }

  async invalidateCache(): Promise<void> {
    await delCache(TICKET_TYPES_CACHE_KEY);
  }
}