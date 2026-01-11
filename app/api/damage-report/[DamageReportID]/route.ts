import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/withcors';
import { DamageReportController } from '@/controllers/damage-report';

const controller = new DamageReportController();

const patchHandler = (req: NextRequest) => controller.handlePatch(req);

export const PATCH = withCors(patchHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));