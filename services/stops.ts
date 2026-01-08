import prisma from '@/client';
import { delCache, getCache, setCache, CACHE_KEYS } from '@/lib/cache';
import { generateFormattedID } from '@/lib/idGenerator';

const STOPS_CACHE_KEY = CACHE_KEYS.STOPS_LIST ?? '';
const ROUTES_CACHE_KEY = CACHE_KEYS.ROUTES ?? '';
const ROUTES_CACHE_KEY_FULL = CACHE_KEYS.ROUTES_FULL ?? '';
const DASHBOARD_CACHE_KEY = CACHE_KEYS.DASHBOARD ?? '';

export class StopsService {
  private applyUpdatedAtLogic<T extends { CreatedAt?: Date | string | null; UpdatedAt?: Date | string | null; UpdatedBy?: any }>(items: T[]) {
    return items.map(item => {
      if (item.CreatedAt && item.UpdatedAt && new Date(item.CreatedAt).getTime() === new Date(item.UpdatedAt).getTime()) {
        return { ...item, UpdatedAt: null, UpdatedBy: null };
      }
      return item;
    });
  }

  async getStopsCached() {
    const cached = await getCache<any[]>(STOPS_CACHE_KEY);
    if (cached) return this.applyUpdatedAtLogic(cached);
    const rows = await prisma.stop.findMany({
      where: { IsDeleted: false },
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        StopID: true,
        StopName: true,
        latitude: true,
        longitude: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
      },
    });
    const processed = this.applyUpdatedAtLogic(rows);
    await setCache(STOPS_CACHE_KEY, processed);
    return processed;
  }

  async createStop(data: { StopName: string; latitude: string; longitude: string }, actor: string | null) {
      const { StopName, latitude, longitude } = data;
      const StopID = await generateFormattedID('STP');

      const newStop = await prisma.stop.create({
        data: {
          StopID,
          StopName,
          latitude,
          longitude,
          CreatedBy: actor,
          UpdatedBy: null,
        },
        select: {
          StopID: true,
          StopName: true,
          latitude: true,
          longitude: true,
          CreatedAt: true,
          UpdatedAt: true,
          CreatedBy: true,
          UpdatedBy: true,
        },
      });
      await delCache(STOPS_CACHE_KEY);
      return this.applyUpdatedAtLogic([newStop])[0];
    }

  async updateStop(StopID: string, data: { StopName?: string; latitude?: string; longitude?: string }, actor: string | null) {
    const existing = await prisma.stop.findUnique({ where: { StopID }, select: { StopID: true } });
    if (!existing) throw new Error('Stop not found');

    const updateData: Record<string, any> = {};
    if (typeof data.StopName === 'string') updateData.StopName = data.StopName;
    if (typeof data.latitude === 'string') updateData.latitude = data.latitude;
    if (typeof data.longitude === 'string') updateData.longitude = data.longitude;
    updateData.UpdatedBy = actor;

    if (Object.keys(updateData).length === 1 && updateData.UpdatedBy) {
      throw new Error('No valid fields provided for update.');
    }

    const updated = await prisma.stop.update({
      where: { StopID },
      data: updateData,
      select: {
        StopID: true,
        StopName: true,
        latitude: true,
        longitude: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
      },
    });

    await delCache(STOPS_CACHE_KEY);
    return this.applyUpdatedAtLogic([updated])[0];
  }

  async patchStopIsDeleted(StopID: string, isDeleted: boolean, actor: string | null) {
    const existing = await prisma.stop.findUnique({ where: { StopID }, select: { StopID: true } });
    if (!existing) throw new Error('Stop not found');

    const updated = await prisma.stop.update({
      where: { StopID },
      data: { IsDeleted: isDeleted, UpdatedBy: actor },
      select: {
        StopID: true,
        StopName: true,
        latitude: true,
        longitude: true,
        IsDeleted: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
      },
    });

    await delCache(STOPS_CACHE_KEY);
    await delCache(ROUTES_CACHE_KEY);
    await delCache(ROUTES_CACHE_KEY_FULL);
    await delCache(DASHBOARD_CACHE_KEY);
    return this.applyUpdatedAtLogic([updated])[0];
  }
}