import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { MaintenanceWorkController } from '@/controllers/maintenance-work';

const controller = new MaintenanceWorkController();

const getHandler = (req: NextRequest) => controller.handleGet(req);

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));