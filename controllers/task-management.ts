import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { TaskManagementService} from '@/services/task-management';
import { TaskUpdateBody } from '@/services/task-management';

const service = new TaskManagementService();

export class TaskManagementController {
  async handleGet(request: NextRequest) {
    const { user, error, status } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    try {
      const { searchParams } = new URL(request.url);
      const filterStatus = searchParams.get('status');
      const filterPriority = searchParams.get('priority');
      const filterDamageID = searchParams.get('damageId');

      const formatted = await service.getMaintenanceWorksWithTasks(
        filterStatus,
        filterPriority,
        filterDamageID
      );

      return NextResponse.json(formatted, { status: 200 });
    } catch (err) {
      console.error('GET_MAINTENANCE_WORK_ERROR', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  async handlePut(request: NextRequest) {
    const { user, error } = await authenticateRequest(request);
    if (error) return NextResponse.json({ error }, { status: 401 });

    // Extract MaintenanceWorkID from URL
    const pathname = request.nextUrl.pathname;
    const pathSegments = pathname.split('/').filter(Boolean);
    const maintenanceWorkId = pathSegments[pathSegments.length - 1];

    if (!maintenanceWorkId)
      return NextResponse.json(
        { error: 'MaintenanceWorkID is required in URL' },
        { status: 400 }
      );

    try {
      const body = (await request.json()) as { Tasks?: TaskUpdateBody[] };
      if (!body || !Array.isArray(body.Tasks))
        return NextResponse.json(
          { error: 'Request body must include Tasks array' },
          { status: 400 }
        );

      const updatedTasks = await service.updateTasksByMaintenanceWork(
        maintenanceWorkId,
        body.Tasks,
        user?.employeeId || null
      );

      return NextResponse.json({ updatedTasks }, { status: 200 });
    } catch (err: any) {
      console.error('PUT_TASKS_BY_MAINTENANCE_ERROR', err);
      const message = err?.message ?? 'Internal server error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
}