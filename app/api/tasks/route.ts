import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth';
import { withCors } from '@/lib/withcors';

const prisma = new PrismaClient();

/**
 * GET /api/tasks?maintenanceWorkId=xxx
 * Get all tasks for a specific maintenance work
 */
const getHandler = async (request: NextRequest) => {
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

    // Verify maintenance work exists
    const maintenanceWork = await prisma.maintenanceWork.findUnique({
      where: { MaintenanceWorkID: maintenanceWorkId }
    });

    if (!maintenanceWork) {
      return NextResponse.json(
        { error: 'Maintenance work not found' },
        { status: 404 }
      );
    }

    // Get all tasks for this maintenance work
    const tasks = await prisma.task.findMany({
      where: { MaintenanceWorkID: maintenanceWorkId },
      orderBy: { CreatedAt: 'asc' }
    });

    return NextResponse.json(tasks, { status: 200 });
  } catch (err) {
    console.error('GET_TASKS_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/tasks
 * Create one or multiple tasks for a maintenance work
 * Body: { maintenanceWorkId, tasks: [{ taskName, taskType, assignedTo, ... }] }
 */
const postHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await request.json();
    const { maintenanceWorkId, tasks } = body;

    if (!maintenanceWorkId) {
      return NextResponse.json(
        { error: 'maintenanceWorkId is required' },
        { status: 400 }
      );
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: 'tasks array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Verify maintenance work exists
    const maintenanceWork = await prisma.maintenanceWork.findUnique({
      where: { MaintenanceWorkID: maintenanceWorkId }
    });

    if (!maintenanceWork) {
      return NextResponse.json(
        { error: 'Maintenance work not found' },
        { status: 404 }
      );
    }

    // Get existing task count for numbering
    const existingTaskCount = await prisma.task.count({
      where: { MaintenanceWorkID: maintenanceWorkId }
    });

    // Create all tasks
    const createdTasks = await Promise.all(
      tasks.map(async (task: any, index: number) => {
        // Generate task number
        const taskNumber = `${maintenanceWorkId}-T-${String(existingTaskCount + index + 1).padStart(3, '0')}`;

        return prisma.task.create({
          data: {
            MaintenanceWorkID: maintenanceWorkId,
            TaskNumber: taskNumber,
            TaskName: task.taskName || task.task_name,
            TaskType: task.taskType || task.task_type || 'General',
            TaskDescription: task.taskDescription || task.task_description,
            AssignedTo: task.assignedTo || task.assignee,
            Status: task.status || 'Pending',
            Priority: task.priority,
            EstimatedHours: task.estimatedHours || task.estimated_hours,
            CreatedBy: user?.userId || null,
            UpdatedBy: user?.userId || null,
          }
        });
      })
    );

    // After creating tasks, check if we need to update parent maintenance work status
    await updateMaintenanceWorkStatus(maintenanceWorkId);

    return NextResponse.json(
      { message: 'Tasks created successfully', tasks: createdTasks },
      { status: 201 }
    );
  } catch (err) {
    console.error('CREATE_TASKS_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to create tasks' },
      { status: 500 }
    );
  }
};

/**
 * PATCH /api/tasks?taskId=xxx
 * Update a specific task
 */
const patchHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      taskName,
      taskType,
      taskDescription,
      assignedTo,
      status: taskStatus,
      priority,
      startDate,
      completedDate,
      estimatedHours,
      actualHours,
      notes
    } = body;

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { TaskID: taskId }
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {
      UpdatedBy: user?.userId || null,
    };

    if (taskName !== undefined) updateData.TaskName = taskName;
    if (taskType !== undefined) updateData.TaskType = taskType;
    if (taskDescription !== undefined) updateData.TaskDescription = taskDescription;
    if (assignedTo !== undefined) updateData.AssignedTo = assignedTo;
    if (taskStatus !== undefined) updateData.Status = taskStatus;
    if (priority !== undefined) updateData.Priority = priority;
    if (startDate !== undefined) updateData.StartDate = startDate ? new Date(startDate) : null;
    if (completedDate !== undefined) updateData.CompletedDate = completedDate ? new Date(completedDate) : null;
    if (estimatedHours !== undefined) updateData.EstimatedHours = estimatedHours;
    if (actualHours !== undefined) updateData.ActualHours = actualHours;
    if (notes !== undefined) updateData.Notes = notes;

    // Update the task
    const updatedTask = await prisma.task.update({
      where: { TaskID: taskId },
      data: updateData
    });

    // Update parent maintenance work status based on all tasks
    await updateMaintenanceWorkStatus(existingTask.MaintenanceWorkID);

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (err) {
    console.error('UPDATE_TASK_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/tasks?taskId=xxx
 * Delete a specific task
 */
const deleteHandler = async (request: NextRequest) => {
  const { user, error, status } = await authenticateRequest(request);
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { TaskID: taskId }
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Delete the task
    await prisma.task.delete({
      where: { TaskID: taskId }
    });

    // Update parent maintenance work status
    await updateMaintenanceWorkStatus(existingTask.MaintenanceWorkID);

    return NextResponse.json(
      { message: 'Task deleted successfully' },
      { status: 200 }
    );
  } catch (err) {
    console.error('DELETE_TASK_ERROR', err);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
};

/**
 * Helper function to update maintenance work status based on tasks
 * Logic:
 * - If all tasks are Completed → MaintenanceWork status = Completed
 * - If any task is InProgress → MaintenanceWork status = InProgress
 * - If all tasks are Pending → MaintenanceWork status = Pending
 * - If no tasks exist → No automatic status change
 */
async function updateMaintenanceWorkStatus(maintenanceWorkId: string) {
  try {
    // Get all tasks for this maintenance work
    const tasks = await prisma.task.findMany({
      where: { MaintenanceWorkID: maintenanceWorkId }
    });

    // If no tasks, don't change status
    if (tasks.length === 0) {
      return;
    }

    let newStatus = 'Pending';

    // Check task statuses
    const allCompleted = tasks.every(task => task.Status === 'Completed');
    const anyInProgress = tasks.some(task => task.Status === 'InProgress');

    if (allCompleted) {
      newStatus = 'Completed';
    } else if (anyInProgress) {
      newStatus = 'InProgress';
    }

    // Update maintenance work status if it has changed
    const maintenanceWork = await prisma.maintenanceWork.findUnique({
      where: { MaintenanceWorkID: maintenanceWorkId }
    });

    if (maintenanceWork && maintenanceWork.Status !== newStatus) {
      await prisma.maintenanceWork.update({
        where: { MaintenanceWorkID: maintenanceWorkId },
        data: {
          Status: newStatus as any,
          CompletedDate: newStatus === 'Completed' ? new Date() : null
        }
      });
    }
  } catch (err) {
    console.error('UPDATE_MAINTENANCE_WORK_STATUS_ERROR', err);
    // Don't throw error, just log it
  }
}

export const GET = withCors(getHandler);
export const POST = withCors(postHandler);
export const PATCH = withCors(patchHandler);
export const DELETE = withCors(deleteHandler);

// Handle OPTIONS preflight requests
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  });

  if (origin && origin === 'http://localhost:3000') {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return new NextResponse(null, { status: 204, headers });
}
