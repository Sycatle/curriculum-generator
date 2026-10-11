import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });
  return cachedTransporter;
}

export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    // Dev fallback: log the email so magic links work without SMTP setup.
    console.log("\n--- [email:dev] ---");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log("--------------------\n");
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "CV Generator <noreply@example.com>",
    to,
    subject,
    text,
    html,
  });
}
