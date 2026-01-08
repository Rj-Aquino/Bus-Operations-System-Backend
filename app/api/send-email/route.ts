import { withCors } from "@/lib/withcors";
import { EmailController } from "@/controllers/send-email";
import { NextRequest, NextResponse } from 'next/server';

const controller = new EmailController();

const postHandler = (req: Request) => controller.handleSend(req);

export const POST = withCors(postHandler);
export const OPTIONS = withCors(() => Promise.resolve(new NextResponse(null, { status: 204 })));
