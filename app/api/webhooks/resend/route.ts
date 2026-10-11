/**
 * Resend webhook handler.
 *
 * Configure the webhook in Resend dashboard pointing to /api/webhooks/resend.
 * Set the signing secret as RESEND_WEBHOOK_SECRET; we verify the Svix headers
 * (Resend uses Svix). Events handled:
 *   - email.bounced     → mark contact bounced + message status
 *   - email.complained  → mark contact complained + message status
 *   - email.delivered   → noop (already 'sent')
 *   - email.opened      → noop
 *
 * Replies aren't a Resend event — handle them separately (forward via
 * inbox rule). Unsubscribes are handled by /u/[token] endpoint.
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { markMessageStatusByResendId } from "@/lib/outreach/repository";

export const runtime = "nodejs";

interface ResendEventEmail {
  email_id?: string;
  to?: string[] | string;
}

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: ResendEventEmail;
}

function verifySignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  // Resend / Svix signature header: "svix-signature" = "v1,<base64>"
  const sigHeader = headers.get("svix-signature");
  const msgId = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  if (!sigHeader || !msgId || !ts) return false;

  // Secret format: "whsec_<base64>"
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const toSign = `${msgId}.${ts}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(toSign).digest();

  for (const sig of sigHeader.split(" ")) {
    const [version, value] = sig.split(",", 2);
    if (version !== "v1" || !value) continue;
    let received: Buffer;
    try {
      received = Buffer.from(value, "base64");
    } catch {
      continue;
    }
    if (received.length === expected.length && timingSafeEqual(received, expected)) {
      return true;
    }
  }
  return false;
}

async function flagContactByEmail(
  email: string,
  field: "bouncedAt" | "complainedAt",
): Promise<void> {
  await db
    .update(schema.contact)
    .set({ [field]: new Date() } as Partial<typeof schema.contact.$inferInsert>)
    .where(eq(schema.contact.email, email.toLowerCase()));
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const raw = await req.text();

  if (secret) {
    if (!verifySignature(raw, req.headers, secret)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } // If no secret set, accept (useful in dev). Log a warning so it's not silent in prod.
  else if (process.env.NODE_ENV === "production") {
    console.warn("[resend webhook] RESEND_WEBHOOK_SECRET not set — accepting unauthenticated event");
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const emailId = event.data?.email_id;
  const to = Array.isArray(event.data?.to) ? event.data.to[0] : event.data?.to;

  switch (event.type) {
    case "email.bounced":
      if (emailId) await markMessageStatusByResendId(emailId, "bounced");
      if (to) await flagContactByEmail(to, "bouncedAt");
      break;
    case "email.complained":
      if (emailId) await markMessageStatusByResendId(emailId, "complained");
      if (to) await flagContactByEmail(to, "complainedAt");
      break;
    case "email.delivered":
    case "email.opened":
    case "email.clicked":
    case "email.sent":
      break;
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
