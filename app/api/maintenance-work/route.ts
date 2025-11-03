import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';
import { generateFormattedID } from '@/lib/idGenerator';

/**
 * POST /api/maintenance-work
 * Creates a new maintenance work from an accepted damage report
 */
const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();
    const {
      damageReportId,
      priority = 'Medium',
      workTitle,
      assignedTo,
      scheduledDate,
      dueDate,
      estimatedCost,
      workNotes
    } = body;

    // Validate required fields
    if (!damageReportId) {
      return NextResponse.json(
        { error: 'damageReportId is required' },
        { status: 400 }
      );
    }

    // Verify that the damage report exists and is accepted
    const damageReport = await prisma.damageReport.findUnique({
      where: { DamageReportID: damageReportId },
      include: {
        RentalBusAssignment: {
          include: {
            BusAssignment: {
              select: {
                BusID: true
              }
            }
          }
        },
        MaintenanceWork: true
      }
    });

    if (!damageReport) {
      return NextResponse.json(
        { error: 'Damage report not found' },
        { status: 404 }
      );
    }

    if (damageReport.Status !== 'Accepted') {
      return NextResponse.json(
        { error: 'Damage report must be accepted before creating maintenance work' },
        { status: 400 }
      );
    }

    // Check if maintenance work already exists for this damage report
    if (damageReport.MaintenanceWork) {
      return NextResponse.json(
        { error: 'Maintenance work already exists for this damage report' },
        { status: 400 }
      );
    }

    // Get BusID from the damage report
    const busId = damageReport.RentalBusAssignment?.BusAssignment?.BusID;
    if (!busId) {
      return NextResponse.json(
        { error: 'Could not determine BusID from damage report' },
        { status: 400 }
      );
    }

    // Generate ID for the maintenance work
    const MaintenanceWorkID = await generateFormattedID('MW');

    // Create the maintenance work
    const maintenanceWork = await prisma.maintenanceWork.create({
      data: {
        MaintenanceWorkID,
        DamageReportID: damageReportId,
        BusID: busId,
        Priority: priority,
        WorkTitle: workTitle || null,
        AssignedTo: assignedTo || null,
        ScheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        DueDate: dueDate ? new Date(dueDate) : null,
        EstimatedCost: estimatedCost || null,
        WorkNotes: workNotes || null,
        CreatedBy: user?.userId || null,
      },
      include: {
        DamageReport: {
          include: {
            RentalRequest: {
              select: {
                CustomerName: true,
                RentalRequestID: true
              }
            },
            RentalBusAssignment: {
              include: {
                BusAssignment: {
                  select: {
                    BusID: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json(maintenanceWork, { status: 201 });
  } catch (err) {
    console.error('CREATE_MAINTENANCE_WORK_ERROR', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create maintenance work' },
      { status: 500 }
    );
  }
};

/**
 * GET /api/maintenance-work
 * Retrieves all maintenance works
 * GET /api/maintenance-work?status=Pending
 * Retrieves maintenance works filtered by status
 */
const getHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    const whereClause: any = {};
    if (statusFilter) {
      whereClause.Status = statusFilter;
    }

    const maintenanceWorks = await prisma.maintenanceWork.findMany({
      where: whereClause,
      include: {
        DamageReport: {
          include: {
            RentalRequest: {
              select: {
                CustomerName: true,
                RentalRequestID: true
              }
            },
            RentalBusAssignment: {
              include: {
                BusAssignment: {
                  select: {
                    BusID: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        CreatedAt: 'desc'
      }
    });

    return NextResponse.json(maintenanceWorks, { status: 200 });
  } catch (err) {
    console.error('GET_MAINTENANCE_WORKS_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to retrieve maintenance works' },
      { status: 500 }
    );
  }
};

/**
 * PATCH /api/maintenance-work?maintenanceWorkId=xxx
 * Updates a maintenance work
 */
const patchHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const maintenanceWorkId = searchParams.get('maintenanceWorkId');

    if (!maintenanceWorkId) {
      return NextResponse.json(
        { error: 'maintenanceWorkId is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      status: workStatus,
      priority,
      workTitle,
      assignedTo,
      scheduledDate,
      dueDate,
      completedDate,
      estimatedCost,
      actualCost,
      workNotes
    } = body;

    // Check if maintenance work exists
    const existingWork = await prisma.maintenanceWork.findUnique({
      where: { MaintenanceWorkID: maintenanceWorkId }
    });

    if (!existingWork) {
      return NextResponse.json(
        { error: 'Maintenance work not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {
      UpdatedBy: user?.userId || null,
    };

    if (workStatus !== undefined) updateData.Status = workStatus;
    if (priority !== undefined) updateData.Priority = priority;
    if (workTitle !== undefined) updateData.WorkTitle = workTitle;
    if (assignedTo !== undefined) updateData.AssignedTo = assignedTo;
    if (scheduledDate !== undefined) updateData.ScheduledDate = scheduledDate ? new Date(scheduledDate) : null;
    if (dueDate !== undefined) updateData.DueDate = dueDate ? new Date(dueDate) : null;
    if (completedDate !== undefined) updateData.CompletedDate = completedDate ? new Date(completedDate) : null;
    if (estimatedCost !== undefined) updateData.EstimatedCost = estimatedCost;
    if (actualCost !== undefined) updateData.ActualCost = actualCost;
    if (workNotes !== undefined) updateData.WorkNotes = workNotes;

    // Update the maintenance work
    const updatedWork = await prisma.maintenanceWork.update({
      where: { MaintenanceWorkID: maintenanceWorkId },
      data: updateData,
      include: {
        DamageReport: {
          include: {
            RentalRequest: {
              select: {
                CustomerName: true,
                RentalRequestID: true
              }
            },
            RentalBusAssignment: {
              include: {
                BusAssignment: {
                  select: {
                    BusID: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return NextResponse.json(updatedWork, { status: 200 });
  } catch (err) {
    console.error('UPDATE_MAINTENANCE_WORK_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to update maintenance work' },
      { status: 500 }
    );
  }
};

export const POST = withCors(postHandler);
export const GET = withCors(getHandler);
export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
