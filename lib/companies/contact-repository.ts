import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { NormalizedContact } from "./enrich/schema";

export type ContactRecord = typeof schema.contact.$inferSelect;

export interface UpsertContactsResult {
  inserted: number;
  updated: number;
}

export async function upsertContacts(
  companyId: string,
  contacts: NormalizedContact[],
): Promise<UpsertContactsResult> {
  if (contacts.length === 0) return { inserted: 0, updated: 0 };

  const values = contacts.map((c) => ({
    companyId,
    email: c.email.toLowerCase(),
    emailKind: c.emailKind,
    firstName: c.firstName ?? null,
    lastName: c.lastName ?? null,
    title: c.title ?? null,
    source: c.source,
    verified: c.verified,
  }));

  const result = await db
    .insert(schema.contact)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.contact.companyId, schema.contact.email],
      set: {
        // Prefer the most reliable source: keep `verified=true` if it was ever true,
        // and fill in fields that were previously null.
        verified: sql`${schema.contact.verified} or excluded.verified`,
        firstName: sql`coalesce(excluded.first_name, ${schema.contact.firstName})`,
        lastName: sql`coalesce(excluded.last_name, ${schema.contact.lastName})`,
        title: sql`coalesce(excluded.title, ${schema.contact.title})`,
        emailKind: sql`excluded.email_kind`,
        // `source` reflects latest enricher to touch the row.
        source: sql`excluded.source`,
      },
    })
    .returning({ id: schema.contact.id, createdAt: schema.contact.createdAt });

  const now = Date.now();
  const inserted = result.filter((r) => now - r.createdAt.getTime() < 10_000).length;
  return { inserted, updated: result.length - inserted };
}

export async function listContactsForCompany(companyId: string): Promise<ContactRecord[]> {
  return db
    .select()
    .from(schema.contact)
    .where(eq(schema.contact.companyId, companyId))
    .orderBy(desc(schema.contact.verified), asc(schema.contact.email));
}

export async function listContactsForUser(
  userId: string,
  limit = 200,
): Promise<(ContactRecord & { companyName: string; companyDomain: string | null })[]> {
  const rows = await db
    .select({
      contact: schema.contact,
      companyName: schema.company.name,
      companyDomain: schema.company.domain,
    })
    .from(schema.contact)
    .innerJoin(schema.company, eq(schema.contact.companyId, schema.company.id))
    .where(eq(schema.company.userId, userId))
    .orderBy(desc(schema.contact.verified), desc(schema.contact.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r.contact,
    companyName: r.companyName,
    companyDomain: r.companyDomain,
  }));
}

export async function markContactUnsubscribed(contactId: string): Promise<void> {
  await db
    .update(schema.contact)
    .set({ unsubscribedAt: new Date() })
    .where(and(eq(schema.contact.id, contactId), sql`${schema.contact.unsubscribedAt} is null`));
}
