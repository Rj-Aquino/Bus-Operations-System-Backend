import { NextResponse } from "next/server";
import { EmailService } from "@/services/send-email";
import { authenticateRequest } from '@/lib/auth';

const service = new EmailService();

export class EmailController {
  async handleSend(req: Request) {
    try {

      const { user, error, status } = await authenticateRequest(req);
      if (error) return NextResponse.json({ error }, { status });

      const body = await req.json();
      const { to, subject, text, html } = body;

      await service.sendEmail({ to, subject, text, html });

      return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });
    } catch (err: any) {
      console.error("EMAIL_CONTROLLER_ERROR", err.message);
      return NextResponse.json(
        { error: err.message || "Failed to send email" },
        { status: 500 }
      );
    }
  }
}
