import prisma from '@/client';
import { fetchNewDrivers, fetchNewConductors, fetchNewBuses, fetchDrivers, fetchBuses } from '@/lib/fetchExternal';

type EmployeeType = 'driver' | 'conductor';
type BusType = 'Aircon' | 'Non-Aircon';

export class ExternalService {
  private mapEmployee(emp: any, type: EmployeeType): any {
    const idField = type === 'driver' ? 'driver_id' : 'conductor_id';
    return {
      [idField]: emp.employeeNumber,
      name: `${emp.firstName} ${emp.middleName ? emp.middleName + ' ' : ''}${emp.lastName}`.trim(),
      contactNo: emp.phone,
      address: [emp.barangay, emp.zipCode].filter(Boolean).join(', ') || null,
    };
  }

  private async getAssignedIDs(type: EmployeeType): Promise<Set<string>> {
    const assignedRecords = await prisma.regularBusAssignment.findMany({
      where: {
        BusAssignment: { IsDeleted: false },
      },
      select: {
        DriverID: type === 'driver',
        ConductorID: type === 'conductor',
      },
    });

    return new Set(
      assignedRecords
        .map(r => type === 'driver' ? r.DriverID : r.ConductorID)
        .filter(Boolean)
        .map(id => String(id))
    );
  }

  private normalizeBusType(raw: string): BusType {
    const low = String(raw ?? '').trim().toLowerCase();
    if (low.includes('non')) return 'Non-Aircon';
    if (low.includes('air')) return 'Aircon';
    return 'Non-Aircon'; // default
  }

  private mapBus(bus: any): any {
    return {
      busId: String(bus.bus_id),
      license_plate: bus.plate_number ?? null,
      body_number: bus.body_number ?? null,
      type: this.normalizeBusType(bus.bus_type),
      capacity: bus.seat_capacity ?? null,
    };
  }

  private async getAssignedBusIDs(): Promise<Set<string>> {
    const assigned = await prisma.busAssignment.findMany({
      where: { IsDeleted: false },
      select: { BusID: true },
    });
    return new Set(assigned.map(b => String(b.BusID)));
  }

  // ========== DRIVERS ==========

  async getUnassignedDrivers(): Promise<any[]> {
    const employees = await fetchNewDrivers();
    const drivers = employees.map((emp: any) => this.mapEmployee(emp, 'driver'));
    const assignedIDs = await this.getAssignedIDs('driver');
    return drivers.filter((d: any) => !assignedIDs.has(String(d.driver_id)));
  }

  async getAllDrivers(): Promise<any[]> {
    const employees = await fetchNewDrivers();
    return employees.map((emp: any) => this.mapEmployee(emp, 'driver'));
  }

  async getAvailableDriversForRent(startDate?: string, duration?: string): Promise<any[]> {
    if ((startDate && !duration) || (!startDate && duration)) {
      throw new Error('Both startDate and duration must be provided together');
    }

    let start: Date | null = null;
    let end: Date | null = null;

    if (startDate && duration) {
      start = new Date(startDate);
      const dur = parseInt(duration, 10);
      if (isNaN(start.getTime()) || isNaN(dur) || dur < 0) {
        throw new Error('Invalid startDate or duration');
      }
      end = new Date(start);
      end.setDate(start.getDate() + dur);
    }

    const excludedIDs = new Set<string>();

    if (start && end) {
      // Quota policies
      const policies = await prisma.quota_Policy.findMany({
        where: {
          AND: [{ StartDate: { lte: end } }, { EndDate: { gte: start } }],
        },
        include: { regularBusAssignment: true },
      });

      for (const p of policies) {
        const rba = (p as any).regularBusAssignment;
        if (rba?.DriverID) excludedIDs.add(String(rba.DriverID));
        if (rba?.ConductorID) excludedIDs.add(String(rba.ConductorID));
      }

      // Rental requests
      const rentalRequests = await prisma.rentalRequest.findMany({
        where: {
          AND: [{ RentalDate: { gte: start } }, { RentalDate: { lte: end } }],
        },
        include: { RentalBusAssignment: { include: { RentalDrivers: true } } },
      });

      for (const rr of rentalRequests) {
        const rba = (rr as any).RentalBusAssignment;
        if (!rba) continue;
        const drivers = rba.RentalDrivers ?? [];
        for (const d of drivers) {
          const did = d?.DriverID ?? d?.driver_id;
          if (did) excludedIDs.add(String(did));
        }
      }
    }

    let employees: any[] = [];
    try {
      const nd = await fetchNewDrivers();
      employees = Array.isArray(nd) && nd.length ? nd : await fetchDrivers().catch(() => []);
    } catch {
      employees = [];
    }

    const drivers = employees.map((emp: any) => this.mapEmployee(emp, 'driver'));
    return drivers.filter(d => !excludedIDs.has(String(d.driver_id)));
  }

  // ========== CONDUCTORS ==========

  async getUnassignedConductors(): Promise<any[]> {
    const employees = await fetchNewConductors();
    const conductors = employees.map((emp: any) => this.mapEmployee(emp, 'conductor'));
    const assignedIDs = await this.getAssignedIDs('conductor');
    return conductors.filter((c: any) => !assignedIDs.has(String(c.conductor_id)));
  }

  async getAllConductors(): Promise<any[]> {
    const employees = await fetchNewConductors();
    return employees.map((emp: any) => this.mapEmployee(emp, 'conductor'));
  }

  // ========== BUSES ==========

  async getUnassignedBuses(): Promise<any[]> {
    const buses = await fetchNewBuses();
    const mappedBuses = buses.map((b: any) => this.mapBus(b));
    const assignedIDs = await this.getAssignedBusIDs();
    return mappedBuses.filter((b: any) => !assignedIDs.has(String(b.busId)));
  }

  async getAllBuses(): Promise<any[]> {
    const buses = await fetchNewBuses();
    return buses.map((b: any) => this.mapBus(b));
  }

  async getAvailableBusesForRent(busType?: string, startDate?: string, duration?: string): Promise<any[]> {
    if ((startDate && !duration) || (!startDate && duration)) {
      throw new Error('Both startDate and duration must be provided together');
    }

    let start: Date | null = null;
    let end: Date | null = null;

    if (startDate && duration) {
      start = new Date(startDate);
      const dur = parseInt(duration, 10);
      if (isNaN(start.getTime()) || isNaN(dur) || dur < 0) {
        throw new Error('Invalid startDate or duration');
      }
      end = new Date(start);
      end.setDate(start.getDate() + dur);
    }

    const excludedBusIDs = new Set<string>();

    if (start && end) {
      const policies = await prisma.quota_Policy.findMany({
        where: {
          AND: [{ StartDate: { lte: end } }, { EndDate: { gte: start } }],
        },
        include: { regularBusAssignment: { include: { BusAssignment: true } } },
      });

      for (const p of policies) {
        const rba = (p as any).regularBusAssignment;
        const ba = rba?.BusAssignment;
        if (ba?.BusID) excludedBusIDs.add(String(ba.BusID));
      }
    }

    let busesRaw: any[] = [];
    try {
      const nb = await fetchNewBuses();
      busesRaw = Array.isArray(nb) && nb.length ? nb : await fetchBuses().catch(() => []);
    } catch {
      busesRaw = [];
    }

    const mappedBuses = busesRaw.map((b: any) => this.mapBus(b));
    const normalizedType = busType ? String(busType).trim().toLowerCase() : null;

    return mappedBuses.filter(b => {
      if (normalizedType) {
        const norm = normalizedType.replace(/[\s\-_]+/g, '').toLowerCase();
        const busNorm = String(b.type).replace(/[\s\-_]+/g, '').toLowerCase();
        if (busNorm !== norm) return false;
      }
      if (excludedBusIDs.has(String(b.busId))) return false;
      return true;
    });
  }

}