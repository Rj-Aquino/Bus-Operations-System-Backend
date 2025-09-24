import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { delCache, CACHE_KEYS } from '@/lib/cache';

type RentalBusAssignmentUpdateData = {
  IsDeleted?: boolean;
  Status?: 'NotStarted' | 'NotReady' | 'InOperation';
  BusAssignment?: {
    update: {
      Battery?: boolean;
      Lights?: boolean;
      Oil?: boolean;
      Water?: boolean;
      Break?: boolean;
      Air?: boolean;
      Gas?: boolean;
      Engine?: boolean;
      TireCondition?: boolean;
      Self_Driver?: boolean;
      Self_Conductor?: boolean;
      IsDeleted?: boolean;
      Status?: 'NotStarted' | 'NotReady' | 'InOperation';
    };
  };
  RentalDrivers?: {
    updateMany: {
      where: { RentalBusAssignmentID: string };
      data: { DriverID?: string };
    }[];
  };
  UpdatedBy?: string | null;
};

function getRentalBusAssignmentFields(body: any): RentalBusAssignmentUpdateData {
  const fields: RentalBusAssignmentUpdateData = {};

  // Nested BusAssignment fields
  const busUpdates: any = {};
  [
    'Battery', 'Lights', 'Oil', 'Water',
    'Break', 'Air', 'Gas', 'Engine',
    'TireCondition', 'Self_Driver', 'Self_Conductor',
    'IsDeleted', 'Status'
  ].forEach((key) => {
    if (body[key] !== undefined) busUpdates[key] = body[key];
  });

  if (Object.keys(busUpdates).length > 0) {
    fields.BusAssignment = { update: busUpdates };
  }

  // RentalDrivers (one-to-many)
  if (body.DriverID) {
    fields.RentalDrivers = {
      updateMany: [
        {
          where: { RentalBusAssignmentID: body.RentalBusAssignmentID },
          data: { DriverID: body.DriverID },
        },
      ],
    };
  }

  return fields;
}


async function fetchFullRentalRecord(RentalBusAssignmentID: string) {
  return prisma.rentalBusAssignment.findUnique({
    where: { RentalBusAssignmentID },
    select: {
      RentalBusAssignmentID: true,
      BusAssignment: {
        select: {
          BusAssignmentID: true,
          BusID: true,
          RouteID: true,
          AssignmentType: true,
          Battery: true,
          Lights: true,
          Oil: true,
          Water: true,
          Break: true,
          Air: true,
          Gas: true,
          Engine: true,
          TireCondition: true,
          Self_Driver: true,
          Self_Conductor: true,
          Status: true,
          IsDeleted: true,
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
        },
      },
      RentalDrivers: {
        select: {
          RentalDriverID: true,
          DriverID: true,
          CreatedAt: true,
          UpdatedAt: true,
        },
      },
      RentalRequests: {
        select: {
          RentalRequestID: true,
          PickupLocation: true,
          DropoffLocation: true,
          NumberOfPassengers: true,
          PickupDateAndTime: true,
          Status: true,
          CreatedAt: true,
          UpdatedAt: true,
        },
      },
      CreatedAt: true,
      UpdatedAt: true,
      CreatedBy: true,
      UpdatedBy: true,
    },
  });
}

function applyAuditLogic(record: any) {
  if (
    record?.CreatedAt &&
    record?.UpdatedAt &&
    new Date(record.CreatedAt).getTime() === new Date(record.UpdatedAt).getTime()
  ) {
    record.UpdatedAt = null;
    record.UpdatedBy = null;
  }
  return record;
}

const putHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  const url = new URL(request.url);
  const RentalBusAssignmentID = url.pathname.split('/').pop();

  if (!RentalBusAssignmentID) {
    return NextResponse.json({ error: 'RentalBusAssignmentID is required in URL' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const rentalFields = getRentalBusAssignmentFields({
      ...body,
      RentalBusAssignmentID,
    });

    const currentAssignment = await prisma.rentalBusAssignment.findUnique({
      where: { RentalBusAssignmentID },
    });

    if (!currentAssignment) {
      return NextResponse.json({ error: 'RentalBusAssignment not found' }, { status: 404 });
    }

    // Update RentalBusAssignment
    await prisma.rentalBusAssignment.update({
      where: { RentalBusAssignmentID },
      data: {
        ...rentalFields,
        UpdatedBy: user?.employeeId || null,
      },
    });

    const updatedFullRecord = await fetchFullRentalRecord(RentalBusAssignmentID);
    const finalRecord = applyAuditLogic(updatedFullRecord);

    // Clear relevant caches
    await delCache(CACHE_KEYS.RENTAL_OPERATIONS_ALL ?? '');

    return NextResponse.json(finalRecord, { status: 200 });
  } catch (err) {
    console.error('Error updating rental bus assignment:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
};

export const PUT = withCors(putHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
