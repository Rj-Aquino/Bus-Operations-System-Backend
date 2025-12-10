import prisma from '@/client';
import { BusOperationStatus, PaymentMethod } from '@prisma/client';
import { generateFormattedID } from '@/lib/idGenerator';
import { delCache, CACHE_KEYS } from '@/lib/cache';

enum AllowedPaymentMethods {
  Reimbursement = 'Reimbursement',
  Company_Cash = 'Company_Cash',
}

const ALLOWED_PAYMENT_METHODS = Object.values(AllowedPaymentMethods);
const CACHE_KEYS_TO_CLEAR = [
  CACHE_KEYS.DASHBOARD ?? '',
  CACHE_KEYS.BUS_OPERATIONS_NOTREADY ?? '',
  CACHE_KEYS.BUS_OPERATIONS_NOTSTARTED ?? '',
  CACHE_KEYS.BUS_OPERATIONS_INOPERATION ?? '',
  CACHE_KEYS.BUS_OPERATIONS_ALL ?? '',
];

type BusAssignmentUpdateData = Partial<{
  Status: BusOperationStatus;
  Battery: boolean;
  Lights: boolean;
  Oil: boolean;
  Water: boolean;
  Brake: boolean;
  Air: boolean;
  Gas: boolean;
  Engine: boolean;
  TireCondition: boolean;
  Self_Driver: boolean;
  Self_Conductor: boolean;
}>;

export class BusOperationsService {
  private readonly booleanFields: (keyof BusAssignmentUpdateData)[] = [
    'Battery',
    'Lights',
    'Oil',
    'Water',
    'Brake',
    'Air',
    'Gas',
    'Engine',
    'TireCondition',
    'Self_Driver',
    'Self_Conductor',
  ];

  private validatePaymentMethod(method: string): void {
    if (!ALLOWED_PAYMENT_METHODS.includes(method as AllowedPaymentMethods)) {
      throw new Error(
        'Invalid Payment_Method. Allowed values: Reimbursement, Company_Cash.'
      );
    }
  }

  private validateStatus(status: string): void {
    if (!Object.values(BusOperationStatus).includes(status as BusOperationStatus)) {
      throw new Error('Invalid status value');
    }
  }

  private getBusAssignmentFields(body: any): BusAssignmentUpdateData {
    const fields: BusAssignmentUpdateData = {};
    if (body.Status) fields.Status = body.Status;
    for (const field of this.booleanFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        fields[field] = body[field];
      }
    }
    return fields;
  }

  private getNewBooleans(fields: BusAssignmentUpdateData, current: any): boolean[] {
    return this.booleanFields.map(field =>
      Object.prototype.hasOwnProperty.call(fields, field) ? !!fields[field] : !!current[field]
    );
  }

  private shouldForceNotReady(status: any, allTrue: boolean): boolean {
    return (
      [BusOperationStatus.NotStarted, BusOperationStatus.InOperation].includes(status) && !allTrue
    );
  }

  private async clearCache(): Promise<void> {
    await Promise.all(CACHE_KEYS_TO_CLEAR.map(key => delCache(key)));
  }

  async updateBusAssignment(busAssignmentID: string, body: any, actor: string | null): Promise<any> {
    // Validation
    if (body.Payment_Method) {
      this.validatePaymentMethod(body.Payment_Method);
    }
    if (body.Status) {
      this.validateStatus(body.Status);
    }

    const busAssignmentFields = this.getBusAssignmentFields(body);

    // Fetch current assignment
    const currentAssignment = await prisma.busAssignment.findUnique({
      where: { BusAssignmentID: busAssignmentID },
      include: { RegularBusAssignment: true },
    });

    if (!currentAssignment) {
      throw new Error('BusAssignment not found');
    }

    const newBooleans = this.getNewBooleans(busAssignmentFields, currentAssignment);
    const requestedStatus = busAssignmentFields.Status || currentAssignment.Status;
    const allTrue = newBooleans.every(val => val === true);

    // Force NotReady if not all checks passed
    if (this.shouldForceNotReady(requestedStatus, allTrue)) {
      busAssignmentFields.Status = BusOperationStatus.NotReady;
    }

    // Validate QuotaPolicy if transitioning to InOperation
    const statusToCheck = body.Status || currentAssignment.Status;
    if (statusToCheck === BusOperationStatus.InOperation) {
      await this.validateQuotaPolicy(
        currentAssignment.RegularBusAssignment?.RegularBusAssignmentID,
        body.DispatchedAt
      );
      // Ensure DispatchedAt is set for downstream use
      if (!('DispatchedAt' in body) || !body.DispatchedAt) {
        body.DispatchedAt = new Date().toISOString();
      }
    }

    // Update BusAssignment
    const updatedBusAssignment = await prisma.busAssignment.update({
      where: { BusAssignmentID: busAssignmentID },
      data: {
        ...busAssignmentFields,
        UpdatedBy: actor,
      },
      include: { RegularBusAssignment: true },
    });

    // Handle BusTrip management
    const latestBusTripID = updatedBusAssignment.RegularBusAssignment?.LatestBusTripID ?? null;
    const regID = updatedBusAssignment.RegularBusAssignment?.RegularBusAssignmentID;

    let targetBusTripID: string | null = null;
    try {
      targetBusTripID = await this.handleBusTrip(body, regID, latestBusTripID, actor);
    } catch (err: any) {
      throw new Error(err.message);
    }

    // Check if user tried to update BusTrip fields
    const hasAnyBusTripField = this.hasBusTripFields(body);
    if (!targetBusTripID && hasAnyBusTripField) {
      throw new Error('No valid BusTrip to update or create');
    }

    // Update BusTrip fields
    if (targetBusTripID) {
      await this.updateBusTripFields(targetBusTripID, body, actor);
    }

    // Update TicketBusTrips
    if (targetBusTripID && Array.isArray(body.TicketBusTrips)) {
      await this.updateTicketBusTrips(targetBusTripID, body.TicketBusTrips, allTrue, busAssignmentID, actor);
    }

    // Handle ResetCompleted
    if (body.ResetCompleted) {
      await this.createDamageReport(busAssignmentID, body, actor);
      const resetRecord = await this.resetAssignment(busAssignmentID, busAssignmentFields, actor);
      await this.clearCache();
      return resetRecord;
    }

    await this.clearCache();
    return this.fetchFullRecord(busAssignmentID);
  }

  private async validateQuotaPolicy(regBusAssignmentID: string | undefined, dispatchedAt: any): Promise<void> {
    let dispatchedAtDate: Date;

    if (dispatchedAt) {
      dispatchedAtDate = new Date(dispatchedAt);
    } else {
      dispatchedAtDate = new Date();
    }

    console.log('[QuotaPolicy Validation] DispatchedAt:', dispatchedAtDate.toISOString());
    console.log('[QuotaPolicy Validation] RegularBusAssignmentID:', regBusAssignmentID);

    if (regBusAssignmentID) {
      const hasPolicy = await prisma.quota_Policy.findFirst({
        where: {
          RegularBusAssignmentID: regBusAssignmentID,
          StartDate: { lte: dispatchedAtDate },
          EndDate: { gte: dispatchedAtDate },
        },
        select: { QuotaPolicyID: true },
      });

      console.log('[QuotaPolicy Validation] Found Policy:', hasPolicy);

      if (!hasPolicy) {
        throw new Error('Cannot dispatch: No active QuotaPolicy for the selected DispatchedAt date/time.');
      }
    }
  }

  private async handleBusTrip(
    body: any,
    regID: string | undefined,
    latestBusTripID: string | null,
    actor: string | null
  ): Promise<string | null> {
    // 1. If LatestBusTripID is in the body, use it
    if ('LatestBusTripID' in body && body.LatestBusTripID) {
      const existingBusTrip = await prisma.busTrip.findUnique({
        where: { BusTripID: body.LatestBusTripID },
      });
      if (!existingBusTrip) throw new Error('Provided LatestBusTripID does not exist.');

      await prisma.regularBusAssignment.update({
        where: { RegularBusAssignmentID: regID },
        data: { LatestBusTripID: body.LatestBusTripID, UpdatedBy: actor },
      });
      return body.LatestBusTripID;
    }

    // 2. If not in body but exists in record, use it
    if (latestBusTripID) {
      return latestBusTripID;
    }

    // 3. If not in body and record is null, create if any BusTrip fields are present
    if (this.hasBusTripFields(body)) {
      if (!regID) throw new Error('RegularBusAssignmentID is required to create a BusTrip.');

      const newBusTripID = await generateFormattedID('BT');
      await prisma.busTrip.create({
        data: {
          BusTripID: newBusTripID,
          RegularBusAssignmentID: regID,
          DispatchedAt: body.DispatchedAt ? new Date(body.DispatchedAt) : null,
          CompletedAt: body.CompletedAt ? new Date(body.CompletedAt) : null,
          Sales: body.Sales ?? null,
          PettyCash: body.PettyCash ?? null,
          Remarks: body.Remarks ?? null,
          TripExpense: body.TripExpense ?? null,
          Payment_Method: body.Payment_Method ?? null,
          CreatedBy: actor,
          UpdatedBy: actor,
        },
      });

      await prisma.regularBusAssignment.update({
        where: { RegularBusAssignmentID: regID },
        data: { LatestBusTripID: newBusTripID, UpdatedBy: actor },
      });

      return newBusTripID;
    }

    return null;
  }

  private hasBusTripFields(body: any): boolean {
    return (
      'DispatchedAt' in body ||
      'Sales' in body ||
      'PettyCash' in body ||
      'CompletedAt' in body ||
      'Remarks' in body ||
      'TripExpense' in body ||
      'Payment_Method' in body
    );
  }

  private async updateBusTripFields(targetBusTripID: string, body: any, actor: string | null): Promise<void> {
    const busTripUpdate: any = {};

    if ('Sales' in body) busTripUpdate.Sales = body.Sales;
    if ('PettyCash' in body) busTripUpdate.PettyCash = body.PettyCash;
    if ('DispatchedAt' in body) busTripUpdate.DispatchedAt = new Date(body.DispatchedAt);
    if ('CompletedAt' in body) busTripUpdate.CompletedAt = body.CompletedAt ? new Date(body.CompletedAt) : null;
    if ('Remarks' in body) busTripUpdate.Remarks = body.Remarks;
    if ('TripExpense' in body) busTripUpdate.TripExpense = body.TripExpense;
    if ('Payment_Method' in body) busTripUpdate.Payment_Method = body.Payment_Method;

    busTripUpdate.UpdatedBy = actor;

    if (Object.keys(busTripUpdate).length > 0) {
      await prisma.busTrip.update({
        where: { BusTripID: targetBusTripID },
        data: busTripUpdate,
      });
    }
  }

  private async updateTicketBusTrips(
    targetBusTripID: string,
    ticketBusTrips: any[],
    allTrue: boolean,
    busAssignmentID: string,
    actor: string | null
  ): Promise<void> {
    // Validate EndingIDNumber
    for (const tbt of ticketBusTrips) {
      if (
        tbt.StartingIDNumber != null &&
        tbt.EndingIDNumber != null &&
        tbt.OverallEndingID != null &&
        (tbt.EndingIDNumber < tbt.StartingIDNumber || tbt.EndingIDNumber > tbt.OverallEndingID)
      ) {
        throw new Error('EndingIDNumber must be between StartingIDNumber and OverallEndingID.');
      }
    }

    // Delete existing
    await prisma.ticketBusTrip.deleteMany({
      where: { BusTripID: targetBusTripID },
    });

    // Create new
    for (const tbt of ticketBusTrips) {
      const newTicketBusTripID = await generateFormattedID('TBT');
      await prisma.ticketBusTrip.create({
        data: {
          TicketBusTripID: newTicketBusTripID,
          BusTripID: targetBusTripID,
          TicketTypeID: tbt.TicketTypeID,
          StartingIDNumber: tbt.StartingIDNumber ?? null,
          EndingIDNumber: tbt.EndingIDNumber ?? null,
          OverallEndingID: tbt.OverallEndingID ?? null,
          CreatedBy: actor,
          UpdatedBy: actor,
        },
      });
    }

    // Check readiness and ticket count
    const ticketCount = await prisma.ticketBusTrip.count({
      where: { BusTripID: targetBusTripID },
    });

    if (allTrue && ticketCount > 0) {
      await prisma.busAssignment.update({
        where: { BusAssignmentID: busAssignmentID },
        data: { Status: BusOperationStatus.NotStarted, UpdatedBy: actor },
      });
    }
  }

  private async createDamageReport(busAssignmentID: string, body: any, actor: string | null): Promise<void> {
    await prisma.damageReport.create({
      data: {
        DamageReportID: await generateFormattedID('DR'),
        BusAssignmentID: busAssignmentID,
        Battery: body.D_Battery ?? false,
        Lights: body.D_Lights ?? false,
        Oil: body.D_Oil ?? false,
        Water: body.D_Water ?? false,
        Brake: body.D_Brake ?? false,
        Air: body.D_Air ?? false,
        Gas: body.D_Gas ?? false,
        Engine: body.D_Engine ?? false,
        TireCondition: body.D_TireCondition ?? false,
        Note: body.D_Note ?? null,
        Status: 'Pending',
        CreatedBy: actor,
        UpdatedBy: actor,
      },
    });
  }

  private async resetAssignment(
    busAssignmentID: string,
    busAssignmentFields: BusAssignmentUpdateData,
    actor: string | null
  ): Promise<any> {
    this.booleanFields.forEach(field => (busAssignmentFields[field] = false as any));
    busAssignmentFields.Status = BusOperationStatus.NotReady;

    const updatedBusAssignment = await prisma.busAssignment.update({
      where: { BusAssignmentID: busAssignmentID },
      data: {
        ...busAssignmentFields,
        UpdatedBy: actor,
      },
      include: { RegularBusAssignment: true },
    });

    // Update LatestBusTrip CompletedAt
    if (updatedBusAssignment.RegularBusAssignment?.LatestBusTripID) {
      await prisma.busTrip.update({
        where: { BusTripID: updatedBusAssignment.RegularBusAssignment.LatestBusTripID },
        data: { CompletedAt: new Date(), UpdatedBy: actor },
      });
    }

    // Clear LatestBusTripID
    if (updatedBusAssignment.RegularBusAssignment?.RegularBusAssignmentID) {
      await prisma.regularBusAssignment.update({
        where: { RegularBusAssignmentID: updatedBusAssignment.RegularBusAssignment.RegularBusAssignmentID },
        data: { LatestBusTripID: null, UpdatedBy: actor },
      });
    }

    return this.fetchFullRecord(busAssignmentID);
  }

  private async fetchFullRecord(busAssignmentID: string): Promise<any> {
    return prisma.busAssignment.findUnique({
      where: { BusAssignmentID: busAssignmentID },
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
        RegularBusAssignment: {
          select: {
            RegularBusAssignmentID: true,
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
            CreatedAt: true,
            UpdatedAt: true,
            CreatedBy: true,
            UpdatedBy: true,
          },
        },
      },
    });
  }
}