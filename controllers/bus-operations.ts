import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { BusOperationsService } from '@/services/bus-operations';
import prisma from '@/client';
import { BusOperationStatus } from '@prisma/client';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';

export class BusOperationsController {
  private service = new BusOperationsService();

  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const statusParam = url.searchParams.get('status');
      const cacheKey = statusParam
        ? `${CACHE_KEYS.BUS_OPERATIONS_ALL}_${statusParam}`
        : CACHE_KEYS.BUS_OPERATIONS_ALL ?? '';

      // Try cache
      const cached = await getCache<any[]>(cacheKey);
      if (cached) {
        const processed = this.applyAuditLogic(cached);
        return NextResponse.json(processed);
      }

      const result = await this.fetchBusOperations(statusParam);
      const processed = this.applyAuditLogic(result);

      // Cache result
      await setCache(cacheKey, processed);

      return NextResponse.json(processed);
    } catch (err) {
      console.error('GET_BUS_OPERATIONS_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch bus operations';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  async handlePut(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const url = new URL(request.url);
      const busAssignmentID = url.pathname.split('/').pop();

      if (!busAssignmentID) {
        return NextResponse.json({ error: 'BusAssignmentID is required in URL' }, { status: 400 });
      }

      const body = await request.json();
      const actor = user?.employeeId || null;

      const result = await this.service.updateBusAssignment(busAssignmentID, body, actor);
      return NextResponse.json(this.applyAuditLogicToRecord(result), { status: 200 });
    } catch (err) {
      console.error('UPDATE_BUS_OPERATIONS_ERROR', err);
      return this.handleError(err);
    }
  }

  private async fetchBusOperations(statusParam: string | null): Promise<any[]> {
    const whereClause: any = {
      IsDeleted: false,
      AssignmentType: 'Regular',
    };

    if (statusParam !== null) {
      const validStatuses = Object.values(BusOperationStatus);
      if (!validStatuses.includes(statusParam as BusOperationStatus)) {
        throw new Error('Invalid status value');
      }
      whereClause.Status = statusParam as BusOperationStatus;
    }

    const busAssignments = await prisma.busAssignment.findMany({
      where: whereClause,
      orderBy: [{ UpdatedAt: 'desc' }, { CreatedAt: 'desc' }],
      select: {
        BusAssignmentID: true,
        BusID: true,
        Battery: true,
        Lights: true,
        Oil: true,
        Water: true,
        Brake: true,
        Air: true,
        Gas: true,
        Engine: true,
        TireCondition: true,
        Self_Driver: true,
        Self_Conductor: true,
        IsDeleted: true,
        Status: true,
        CreatedAt: true,
        UpdatedAt: true,
        CreatedBy: true,
        UpdatedBy: true,
        Route: {
          select: {
            RouteID: true,
            RouteName: true,
          },
        },
        RegularBusAssignment: {
          select: {
            DriverID: true,
            ConductorID: true,
            LatestBusTripID: true,
            LatestBusTrip: {
              select: {
                BusTripID: true,
                DispatchedAt: true,
                CompletedAt: true,
                Sales: true,
                PettyCash: true,
                Remarks: true,
                TripExpense: true,
                Payment_Method: true,
                TicketBusTrips: {
                  select: {
                    TicketBusTripID: true,
                    StartingIDNumber: true,
                    EndingIDNumber: true,
                    OverallEndingID: true,
                    TicketType: {
                      select: {
                        TicketTypeID: true,
                        Value: true,
                      },
                    },
                  },
                },
              },
            },
            QuotaPolicies: {
              select: {
                QuotaPolicyID: true,
                StartDate: true,
                EndDate: true,
                Fixed: { select: { Quota: true } },
                Percentage: { select: { Percentage: true } },
              },
            },
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
          },
        },
        DamageReports: {
          orderBy: { CheckDate: 'desc' },
          take: 1,
          select: {
            DamageReportID: true,
            Battery: true,
            Lights: true,
            Oil: true,
            Water: true,
            Brake: true,
            Air: true,
            Gas: true,
            Engine: true,
            TireCondition: true,
            Note: true,
            CheckDate: true,
          },
        },
      },
    });

    return busAssignments.map(assignment => {
      let regular = assignment.RegularBusAssignment;

      if (regular && regular.LatestBusTripID === null) {
        const { LatestBusTrip, ...rest } = regular;
        regular = { ...rest, LatestBusTrip: null };
      }

      const latestDamageReport = assignment.DamageReports?.[0] ?? null;
      const { DamageReports, ...assignmentWithoutDamage } = assignment;

      return {
        ...assignmentWithoutDamage,
        RegularBusAssignment: regular,
        LatestDamageReport: latestDamageReport,
      };
    });
  }

  private applyAuditLogic(records: any[]): any[] {
    return records.map(item => this.applyAuditLogicToRecord(item));
  }

  private applyAuditLogicToRecord(record: any): any {
    let reg = record?.RegularBusAssignment;
    if (
      reg &&
      reg.CreatedAt &&
      reg.UpdatedAt &&
      new Date(reg.CreatedAt).getTime() === new Date(reg.UpdatedAt).getTime()
    ) {
      reg = { ...reg, UpdatedAt: null, UpdatedBy: null };
    }

    let processedAssignment: any = record;
    if (
      record?.CreatedAt &&
      record?.UpdatedAt &&
      new Date(record.CreatedAt).getTime() === new Date(record.UpdatedAt).getTime()
    ) {
      processedAssignment = { ...record, UpdatedAt: null, UpdatedBy: null };
    }

    return {
      ...processedAssignment,
      RegularBusAssignment: reg,
    };
  }

  private handleError(err: any): NextResponse {
    console.error('Error details:', err);

    if (err.message === 'EndingIDNumber must be between StartingIDNumber and OverallEndingID.') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (err.code === 'P2003' && String(err.message).includes('TicketBusTripAssignment_TicketTypeID_fkey')) {
      return NextResponse.json({ error: 'Invalid TicketTypeID: Ticket type does not exist.' }, { status: 400 });
    }

    if (err.code === 'P2000' && String(err.message).includes('Payment_Method')) {
      return NextResponse.json(
        { error: 'Invalid Payment_Method. Allowed values: Reimbursement, Company_Cash.' },
        { status: 400 }
      );
    }

    if (err.message?.includes('QuotaPolicy') || err.message?.includes('Cannot dispatch')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json({ error: err.message || 'Failed to update bus operations' }, { status: 500 });
  }
}