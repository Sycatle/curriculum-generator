/**
 * Mailbox pool — handles rotation between multiple sender addresses to spread
 * volume and protect deliverability.
 *
 * Config via OUTREACH_FROM_ADDRESSES (preferred) or fallback to single
 * OUTREACH_FROM_ADDRESS. Format: comma-separated list of full RFC 5322 from
 * lines:
 *
 *   OUTREACH_FROM_ADDRESSES="Sylvain <s1@mail.example.com>,Sylvain <s2@news.example.com>"
 *
 * Each mailbox should live on a DEDICATED outbound sub-domain with SPF/DKIM/
 * DMARC properly set. Don't reuse your primary domain.
 *
 * Daily cap per mailbox: OUTREACH_DAILY_CAP_PER_MAILBOX (default 50, max 200
 * recommended after warmup).
 */

import { count, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

export interface MailboxState {
  fromAddress: string;
  sentToday: number;
  available: boolean;
  capacity: number;
}

export function getMailboxes(): string[] {
  const list = process.env.OUTREACH_FROM_ADDRESSES;
  if (list) {
    return list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const single = process.env.OUTREACH_FROM_ADDRESS;
  return single ? [single] : [];
}

export function getDailyCap(): number {
  const raw = process.env.OUTREACH_DAILY_CAP_PER_MAILBOX;
  if (!raw) return 50;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 50;
}

export function getCooldownMs(): { min: number; max: number } {
  const min = Number(process.env.OUTREACH_COOLDOWN_MIN_MS ?? 30_000);
  const max = Number(process.env.OUTREACH_COOLDOWN_MAX_MS ?? 60_000);
  return {
    min: Number.isFinite(min) && min >= 0 ? min : 30_000,
    max: Number.isFinite(max) && max > min ? max : Math.max(min + 1_000, 60_000),
  };
}

/**
 * Returns one usage row per configured mailbox over the last 24h.
 * Mailbox with the smallest `sentToday` (and remaining capacity > 0) wins.
 */
export async function getMailboxStates(userId: string): Promise<MailboxState[]> {
  const mailboxes = getMailboxes();
  if (mailboxes.length === 0) return [];

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await db
    .select({
      fromAddress: schema.outreachMessage.fromAddress,
      n: count(schema.outreachMessage.id),
    })
    .from(schema.outreachMessage)
    .where(
      sql`${schema.outreachMessage.userId} = ${userId} and ${schema.outreachMessage.sentAt} is not null and ${schema.outreachMessage.sentAt} >= ${dayAgo}`,
    )
    .groupBy(schema.outreachMessage.fromAddress);

  const byAddr = new Map<string, number>();
  for (const r of rows) byAddr.set(r.fromAddress, Number(r.n));

  const cap = getDailyCap();
  return mailboxes.map((from) => {
    const sent = byAddr.get(from) ?? 0;
    return {
      fromAddress: from,
      sentToday: sent,
      capacity: cap,
      available: sent < cap,
    };
  });
}

/**
 * Pick the mailbox with the most remaining capacity. Returns null if all are
 * at their daily cap (caller should pause until tomorrow).
 */
export async function pickMailbox(userId: string): Promise<string | null> {
  const states = await getMailboxStates(userId);
  const available = states.filter((s) => s.available);
  if (available.length === 0) return null;
  // Pick the least-used one (load-balance) to spread reputation evenly.
  available.sort((a, b) => a.sentToday - b.sentToday);
  return available[0]!.fromAddress;
}

/** Recently-sent messages by this user across all mailboxes (last `n` count). */
export async function lastSentAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ sentAt: schema.outreachMessage.sentAt })
    .from(schema.outreachMessage)
    .where(
      sql`${schema.outreachMessage.userId} = ${userId} and ${schema.outreachMessage.sentAt} is not null`,
    )
    .orderBy(sql`${schema.outreachMessage.sentAt} desc`)
    .limit(1);
  return row?.sentAt ?? null;
}

/** Compatibility helper for the per-mailbox 24h count check. */
export async function sentInLastDayFromMailbox(
  userId: string,
  fromAddress: string,
): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const [row] = await db
    .select({ n: count(schema.outreachMessage.id) })
    .from(schema.outreachMessage)
    .where(
      sql`${schema.outreachMessage.userId} = ${userId} and ${schema.outreachMessage.fromAddress} = ${fromAddress} and ${schema.outreachMessage.sentAt} >= ${dayAgo}`,
    );
  return Number(row?.n ?? 0);
}

