import prisma from '@/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { delCache, setCache, getCache, CACHE_KEYS } from '@/lib/cache';

const ROUTES_CACHE_KEY = CACHE_KEYS.ROUTES ?? '';
const ROUTES_CACHE_KEY_FULL = CACHE_KEYS.ROUTES_FULL ?? '';
const DASHBOARD_CACHE_KEY = CACHE_KEYS.DASHBOARD ?? '';

type RouteStopInput = {
  StopID: string | { StopID: string };
  StopOrder: number;
};

export class RouteManagementService {
  private applyUpdatedAtLogic<T extends { CreatedAt?: Date | string | null; UpdatedAt?: Date | string | null; UpdatedBy?: any }>(items: T[]) {
    return items.map(item => {
      if (item.CreatedAt && item.UpdatedAt && new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });
  }

  async getSummaryCached(): Promise<any[]> {
    const cached = await getCache<any[]>(ROUTES_CACHE_KEY);
    if (cached) return this.applyUpdatedAtLogic(cached);
    const rows = await prisma.route.findMany({
      where: { IsDeleted: false },
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        RouteID: true,
        RouteName: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        StartStop: { select: { StopName: true } },
        EndStop: { select: { StopName: true } },
      },
    });
    const processed = this.applyUpdatedAtLogic(rows);
    await setCache(ROUTES_CACHE_KEY, processed);
    return processed;
  }

  async getFullCached(): Promise<any[]> {
    const cached = await getCache<any[]>(ROUTES_CACHE_KEY_FULL);
    if (cached) return this.applyUpdatedAtLogic(cached);
    const rows = await prisma.route.findMany({
      where: { IsDeleted: false },
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        RouteID: true,
        RouteName: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        StartStop: { select: { StopID: true, StopName: true, longitude: true, latitude: true } },
        EndStop: { select: { StopID: true, StopName: true, longitude: true, latitude: true } },
        RouteStops: {
          select: {
            StopOrder: true,
            Stop: { select: { StopID: true, StopName: true, longitude: true, latitude: true } },
          },
        },
      },
    });
    const processed = this.applyUpdatedAtLogic(rows);
    await setCache(ROUTES_CACHE_KEY_FULL, processed);
    return processed;
  }

  private normalizeRouteStops(raw: RouteStopInput[]) {
    return raw.map(s => ({
      StopID: typeof s.StopID === 'string' ? s.StopID : s.StopID?.StopID,
      StopOrder: s.StopOrder,
    }));
  }

  private async invalidateCaches() {
    await Promise.all([
      delCache(ROUTES_CACHE_KEY),
      delCache(ROUTES_CACHE_KEY_FULL),
      delCache(DASHBOARD_CACHE_KEY),
    ]);
  }

  async createRoute(data: any, actor: string | null) {
    if (data.StartStopID === data.EndStopID) throw new Error('StartStop and EndStop cannot be the same.');
    const rawRouteStops: RouteStopInput[] = Array.isArray(data.RouteStops) ? data.RouteStops : [];
    const normalized = this.normalizeRouteStops(rawRouteStops);
    const stopIds = normalized.map(s => s.StopID);
    if (stopIds.includes(data.StartStopID) || stopIds.includes(data.EndStopID)) {
      throw new Error('StartStop and EndStop should not be included in RouteStops.');
    }
    const dup = stopIds.length !== new Set(stopIds).size;
    if (dup) throw new Error('Duplicate stops are not allowed in a route.');

    const RouteID = await generateFormattedID('RT');
    const routeStopCreates = await Promise.all(normalized.map(async s => ({
      RouteStopID: await generateFormattedID('RTS'),
      RouteID,
      StopID: s.StopID,
      StopOrder: s.StopOrder,
    })));

    const [route] = await prisma.$transaction([
      prisma.route.create({
        data: {
          RouteID,
          RouteName: data.RouteName,
          StartStopID: data.StartStopID,
          EndStopID: data.EndStopID,
          IsDeleted: false,
          CreatedBy: actor,
          UpdatedBy: null,
        },
        select: {
          RouteID: true,
          RouteName: true,
          CreatedAt: true,
          UpdatedAt: true,
          CreatedBy: true,
          UpdatedBy: true,
          StartStop: { select: { StopName: true } },
          EndStop: { select: { StopName: true } },
        },
      }),
      ...routeStopCreates.map(rs => prisma.routeStop.create({ data: rs })),
    ]);

    await this.invalidateCaches();
    return this.applyUpdatedAtLogic([route])[0];
  }

  async updateRoute(RouteID: string, data: any, actor: string | null) {
    const existing = await prisma.route.findUnique({ where: { RouteID } });
    if (!existing) throw new Error('Route not found.');

    if (data.StartStopID && data.EndStopID && data.StartStopID === data.EndStopID) {
      throw new Error('StartStop and EndStop cannot be the same.');
    }

    const rawRouteStops: RouteStopInput[] = Array.isArray(data.RouteStops) ? data.RouteStops : [];
    const normalized = this.normalizeRouteStops(rawRouteStops);
    const stopIds = normalized.map(s => s.StopID);
    const dup = stopIds.length !== new Set(stopIds).size;
    if (dup) throw new Error('No duplicate stops allowed in the RouteStops list.');

    const startAndEndSet = new Set([data.StartStopID ?? existing.StartStopID, data.EndStopID ?? existing.EndStopID]);
    if (startAndEndSet.has(null) === false) { /* noop */ }
    for (const id of startAndEndSet) {
      if (id && stopIds.includes(id)) throw new Error('StartStop and EndStop should not be included in RouteStops list.');
    }

    const updatedRoute = await prisma.route.update({
      where: { RouteID },
      data: {
        RouteName: data.RouteName ?? existing.RouteName,
        StartStopID: data.StartStopID ?? existing.StartStopID,
        EndStopID: data.EndStopID ?? existing.EndStopID,
        UpdatedBy: actor,
      },
      select: {
        RouteID: true,
        RouteName: true,
        StartStopID: true,
        EndStopID: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
      },
    });

    await prisma.routeStop.deleteMany({ where: { RouteID } });

    if (normalized.length > 0) {
      const stopsWithIDs = await Promise.all(normalized.map(async s => ({
        ...s,
        RouteStopID: await generateFormattedID('RTS'),
      })));
      await prisma.$transaction(stopsWithIDs.map(s => prisma.routeStop.create({ data: { RouteStopID: s.RouteStopID, RouteID, StopID: s.StopID, StopOrder: s.StopOrder } })));
    }

    await this.invalidateCaches();
    return updatedRoute;
  }

  async patchRouteIsDeleted(RouteID: string, isDeleted: boolean, actor: string | null) {
    const existing = await prisma.route.findUnique({ where: { RouteID } });
    if (!existing) throw new Error('Route not found.');
    const updated = await prisma.route.update({
      where: { RouteID },
      data: { IsDeleted: isDeleted, UpdatedBy: actor },
      select: { RouteID: true, RouteName: true, IsDeleted: true, CreatedAt: true, UpdatedAt: true, CreatedBy: true, UpdatedBy: true },
    });
    await this.invalidateCaches();
    return updated;
  }
}