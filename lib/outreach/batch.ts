/**
 * Batch outreach runner — picks N eligible contacts and sends one message
 * per "tick" (cooldown between sends to mimic a human pace).
 *
 * Eligibility rules:
 *   - Contact is not unsubscribed / bounced / complained.
 *   - User has NOT previously messaged this contact.
 *   - Company belongs to the user.
 *   - Optional: only verified=true contacts (configurable).
 *
 * Mailbox is rotated per send (least-used today wins). If all mailboxes are
 * at their daily cap, the run stops.
 *
 * This runner is invoked from POST /api/outreach/batch synchronously. For
 * volumes > ~20 messages, prefer kicking it off as a background process or
 * splitting into multiple invocations to stay under Vercel/Caddy timeouts.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { sendOutreach } from "./pipeline";
import { getCooldownMs, pickMailbox } from "./mailboxes";

export interface BatchOptions {
  userId: string;
  cvId: string;
  limit: number;
  onlyVerified?: boolean;
  onlyRemoteFriendly?: boolean;
  dryRun?: boolean;
}

export interface BatchResultRow {
  contactId: string;
  email: string;
  status: string;
  reason?: string;
  resendId?: string;
  fromAddress?: string;
}

export interface BatchSummary {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  capReached: boolean;
  rows: BatchResultRow[];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(min: number, max: number): number {
  return min + Math.floor(Math.random() * Math.max(1, max - min));
}

export async function runBatch(opts: BatchOptions): Promise<BatchSummary> {
  const summary: BatchSummary = {
    attempted: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    capReached: false,
    rows: [],
  };

  // 1. Pull eligible contacts in a single query.
  //    Exclude contacts already messaged by this user (left join + null check).
  const eligibilityConditions = [
    eq(schema.company.userId, opts.userId),
    isNull(schema.contact.unsubscribedAt),
    isNull(schema.contact.bouncedAt),
    isNull(schema.contact.complainedAt),
  ];
  if (opts.onlyVerified) {
    eligibilityConditions.push(eq(schema.contact.verified, true));
  }
  if (opts.onlyRemoteFriendly) {
    eligibilityConditions.push(eq(schema.company.remoteFriendly, true));
  }

  const candidates = await db
    .select({
      contactId: schema.contact.id,
      email: schema.contact.email,
    })
    .from(schema.contact)
    .innerJoin(schema.company, eq(schema.contact.companyId, schema.company.id))
    .where(
      and(
        ...eligibilityConditions,
        sql`not exists (
          select 1 from ${schema.outreachMessage}
          where ${schema.outreachMessage.contactId} = ${schema.contact.id}
            and ${schema.outreachMessage.userId} = ${opts.userId}
        )`,
      ),
    )
    .orderBy(sql`${schema.contact.verified} desc, ${schema.contact.createdAt} asc`)
    .limit(opts.limit);

  const { min, max } = getCooldownMs();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    summary.attempted++;

    const fromAddress = await pickMailbox(opts.userId);
    if (!fromAddress) {
      summary.capReached = true;
      summary.rows.push({
        contactId: c.contactId,
        email: c.email,
        status: "cap-reached",
        reason: "All mailboxes at daily cap",
      });
      break;
    }

    try {
      const result = await sendOutreach({
        userId: opts.userId,
        cvId: opts.cvId,
        contactId: c.contactId,
        fromOverride: fromAddress,
        dryRun: opts.dryRun ?? false,
      });
      summary.rows.push({
        contactId: c.contactId,
        email: c.email,
        status: result.status,
        reason: result.reason,
        resendId: result.resendId,
        fromAddress,
      });
      if (result.status === "sent") summary.sent++;
      else if (result.status === "skipped" || result.status === "preview") summary.skipped++;
      else summary.failed++;
    } catch (err) {
      summary.failed++;
      summary.rows.push({
        contactId: c.contactId,
        email: c.email,
        status: "failed",
        reason: err instanceof Error ? err.message : "unknown",
        fromAddress,
      });
    }

    // Cooldown between sends (skip for dry runs and after the last one).
    if (!opts.dryRun && i < candidates.length - 1) {
      await sleep(jitter(min, max));
    }
  }

  return summary;
}
