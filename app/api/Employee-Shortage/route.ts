import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { EmployeeShortageController } from '@/controllers/Employee-Shortage';

const controller = new EmployeeShortageController();

const getHandler = (req: NextRequest) => controller.handleGet(req);

export const GET = withCors(getHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));