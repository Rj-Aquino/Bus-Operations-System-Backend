import { transporter } from "@/lib/mailer";

interface SendEmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  async sendEmail({ to, subject, text, html }: SendEmailParams) {
    if (!to || !subject || (!text && !html)) {
      throw new Error("Missing email fields");
    }

    try {
      const info = await transporter.sendMail({
        from: `"Bus Operations System" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html,
      });
      return info;
    } catch (err) {
      console.error("EMAIL_SERVICE_ERROR", err);
      throw err;
    }
  }
}
