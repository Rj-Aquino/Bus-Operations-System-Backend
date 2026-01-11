import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { MaintenanceWorkController } from '@/controllers/maintenance-work';

const controller = new MaintenanceWorkController();

const putHandler = (req: NextRequest) => controller.handlePut(req);

export const PUT = withCors(putHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));