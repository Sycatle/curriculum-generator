import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { NormalizedCompany } from "./schema";

export type CompanyRecord = typeof schema.company.$inferSelect;

export interface UpsertCompaniesResult {
  inserted: number;
  updated: number;
}

export async function upsertCompanies(
  userId: string,
  companies: NormalizedCompany[],
): Promise<UpsertCompaniesResult> {
  if (companies.length === 0) return { inserted: 0, updated: 0 };

  const values = companies.map((c) => ({
    userId,
    discoveredFrom: c.source,
    externalId: c.externalId,
    name: c.name,
    domain: c.domain ?? null,
    country: c.country ?? null,
    city: c.city ?? null,
    postalCode: c.postalCode ?? null,
    activityCode: c.activityCode ?? null,
    activityLabel: c.activityLabel ?? null,
    headcount: c.headcount ?? null,
    headcountMin: c.headcountMin ?? null,
    headcountMax: c.headcountMax ?? null,
    raw: c.raw,
  }));

  const result = await db
    .insert(schema.company)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.company.userId, schema.company.discoveredFrom, schema.company.externalId],
      set: {
        name: sql`excluded.name`,
        domain: sql`coalesce(excluded.domain, ${schema.company.domain})`,
        city: sql`excluded.city`,
        postalCode: sql`excluded.postal_code`,
        activityCode: sql`excluded.activity_code`,
        activityLabel: sql`excluded.activity_label`,
        headcount: sql`excluded.headcount`,
        headcountMin: sql`excluded.headcount_min`,
        headcountMax: sql`excluded.headcount_max`,
        raw: sql`excluded.raw`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.company.id, discoveredAt: schema.company.discoveredAt });

  const now = Date.now();
  const inserted = result.filter((r) => now - r.discoveredAt.getTime() < 10_000).length;
  return { inserted, updated: result.length - inserted };
}

export interface ListCompaniesFilter {
  query?: string;
  activityCode?: string;
  city?: string;
  minHeadcount?: number;
  maxHeadcount?: number;
  source?: string;
  limit?: number;
  offset?: number;
}

export async function listCompaniesForUser(
  userId: string,
  filter: ListCompaniesFilter = {},
): Promise<CompanyRecord[]> {
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  const conditions = [eq(schema.company.userId, userId)];
  if (filter.source) conditions.push(eq(schema.company.discoveredFrom, filter.source));
  if (filter.activityCode) conditions.push(eq(schema.company.activityCode, filter.activityCode));
  if (filter.city) {
    const c = `%${filter.city.toLowerCase()}%`;
    conditions.push(sql`lower(${schema.company.city}) like ${c}`);
  }
  if (typeof filter.minHeadcount === "number") {
    conditions.push(sql`${schema.company.headcountMin} >= ${filter.minHeadcount}`);
  }
  if (typeof filter.maxHeadcount === "number") {
    conditions.push(sql`${schema.company.headcountMax} <= ${filter.maxHeadcount}`);
  }
  if (filter.query) {
    const q = `%${filter.query.toLowerCase()}%`;
    conditions.push(
      sql`(lower(${schema.company.name}) like ${q} or lower(${schema.company.domain}) like ${q})`,
    );
  }

  return db
    .select()
    .from(schema.company)
    .where(and(...conditions))
    .orderBy(desc(schema.company.discoveredAt))
    .limit(limit)
    .offset(offset);
}

export async function getCompanyForUser(id: string, userId: string): Promise<CompanyRecord | null> {
  const [row] = await db
    .select()
    .from(schema.company)
    .where(and(eq(schema.company.id, id), eq(schema.company.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function deleteCompany(id: string, userId: string): Promise<void> {
  await db
    .delete(schema.company)
    .where(and(eq(schema.company.id, id), eq(schema.company.userId, userId)));
}

export async function updateCompanyLang(
  id: string,
  lang: "fr" | "en" | "both" | null,
): Promise<void> {
  await db
    .update(schema.company)
    .set({ websiteLang: lang, updatedAt: new Date() })
    .where(eq(schema.company.id, id));
}

export async function setCompanyDomain(id: string, domain: string): Promise<void> {
  await db
    .update(schema.company)
    .set({ domain, updatedAt: new Date() })
    .where(eq(schema.company.id, id));
}
