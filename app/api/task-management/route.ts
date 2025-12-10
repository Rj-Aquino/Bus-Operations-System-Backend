import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { TaskManagementController } from '@/controllers/task-management';

const controller = new TaskManagementController();

const getHandler = (req: NextRequest) => controller.handleGet(req);

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));