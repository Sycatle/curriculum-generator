import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

export type OutreachMessageRecord = typeof schema.outreachMessage.$inferSelect;

/**
 * Canonical funnel statuses (in order). The schema column is a free-form
 * text so we can extend without a migration; this constant is the source of
 * truth for valid transitions.
 */
export const FUNNEL_STATUSES = [
  "queued",
  "sent",
  "bounced",
  "complained",
  "unsubscribed",
  "replied",
  "interview",
  "hired",
  "lost",
  "failed",
] as const;
export type FunnelStatus = (typeof FUNNEL_STATUSES)[number];

/**
 * Statuses that the user can transition to manually (the rest are set by
 * the system: queued/sent by the pipeline, bounced/complained/unsubscribed
 * by webhooks, failed on send error).
 */
export const MANUAL_TRANSITIONS = new Set<FunnelStatus>([
  "replied",
  "interview",
  "hired",
  "lost",
]);

export interface InsertOutreachMessageInput {
  userId: string;
  contactId: string;
  cvId: string;
  cvRevisionId?: string | null;
  lang: "fr" | "en";
  subject: string;
  bodyMarkdown: string;
  fromAddress: string;
}

export async function insertQueuedMessage(
  input: InsertOutreachMessageInput,
): Promise<OutreachMessageRecord> {
  const [row] = await db
    .insert(schema.outreachMessage)
    .values({
      userId: input.userId,
      contactId: input.contactId,
      cvId: input.cvId,
      cvRevisionId: input.cvRevisionId ?? null,
      lang: input.lang,
      subject: input.subject,
      bodyMarkdown: input.bodyMarkdown,
      fromAddress: input.fromAddress,
      status: "queued",
    })
    .returning();
  return row!;
}

export async function markMessageSent(
  id: string,
  resendMessageId: string,
): Promise<void> {
  await db
    .update(schema.outreachMessage)
    .set({ status: "sent", resendMessageId, sentAt: new Date(), error: null })
    .where(eq(schema.outreachMessage.id, id));
}

export async function markMessageFailed(id: string, error: string): Promise<void> {
  await db
    .update(schema.outreachMessage)
    .set({ status: "failed", error })
    .where(eq(schema.outreachMessage.id, id));
}

export async function markMessageStatusByResendId(
  resendMessageId: string,
  status: "bounced" | "complained" | "replied" | "unsubscribed",
): Promise<void> {
  await db
    .update(schema.outreachMessage)
    .set({ status })
    .where(eq(schema.outreachMessage.resendMessageId, resendMessageId));
}

export async function listMessagesForUser(
  userId: string,
  limit = 100,
): Promise<OutreachMessageRecord[]> {
  return db
    .select()
    .from(schema.outreachMessage)
    .where(eq(schema.outreachMessage.userId, userId))
    .orderBy(desc(schema.outreachMessage.createdAt))
    .limit(limit);
}

export async function listMessagesForContact(contactId: string): Promise<OutreachMessageRecord[]> {
  return db
    .select()
    .from(schema.outreachMessage)
    .where(eq(schema.outreachMessage.contactId, contactId))
    .orderBy(desc(schema.outreachMessage.createdAt));
}

/**
 * Manually transition a message's status. Only owner can update.
 * Returns updated row or null if not found / not owned.
 */
export async function setMessageStatus(
  messageId: string,
  userId: string,
  status: FunnelStatus,
): Promise<OutreachMessageRecord | null> {
  const [row] = await db
    .update(schema.outreachMessage)
    .set({ status })
    .where(
      and(eq(schema.outreachMessage.id, messageId), eq(schema.outreachMessage.userId, userId)),
    )
    .returning();
  return row ?? null;
}

/**
 * Check whether the user has *already* messaged this contact (any status).
 * Used to enforce the "never re-contact" idempotence rule.
 */
export async function hasMessagedContact(userId: string, contactId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.outreachMessage.id })
    .from(schema.outreachMessage)
    .where(
      and(
        eq(schema.outreachMessage.userId, userId),
        eq(schema.outreachMessage.contactId, contactId),
      ),
    )
    .limit(1);
  return !!row;
}
