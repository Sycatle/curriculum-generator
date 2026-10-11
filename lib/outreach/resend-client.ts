/**
 * Thin Resend wrapper.
 *
 * Env:
 *   RESEND_API_KEY         — Resend Pro key
 *   OUTREACH_FROM_ADDRESS  — e.g. "Sylvain Cattle <outreach@mail.yourname.dev>"
 *
 * NOTE: outreach must come from a sub-domain dedicated to outbound, never
 * the main domain. Configure SPF/DKIM/DMARC on that sub-domain in Resend's
 * dashboard before sending the first email.
 */

import { Resend } from "resend";

let cached: Resend | null = null;

function getResend(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  cached = new Resend(apiKey);
  return cached;
}

export function getDefaultFromAddress(): string {
  const from = process.env.OUTREACH_FROM_ADDRESS;
  if (!from) throw new Error("OUTREACH_FROM_ADDRESS is not set");
  return from;
}

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer | string }[];
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  const client = getResend();
  const result = await client.emails.send({
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
    attachments: params.attachments,
    tags: params.tags,
    headers: params.headers,
  });

  if (result.error) {
    throw new Error(`Resend: ${result.error.message ?? "unknown error"}`);
  }
  if (!result.data?.id) {
    throw new Error("Resend returned no message id");
  }
  return { id: result.data.id };
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.OUTREACH_FROM_ADDRESS;
}
