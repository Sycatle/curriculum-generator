/**
 * Repository — DB operations on job_source and job_posting.
 *
 * Connectors don't touch the DB; this layer does. Upsert is idempotent on
 * (source_id, external_id).
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { ConnectorKind, NormalizedPosting } from "./schema";

export type JobSourceRecord = typeof schema.jobSource.$inferSelect;
export type JobPostingRecord = typeof schema.jobPosting.$inferSelect;

export async function listSources(userId: string): Promise<JobSourceRecord[]> {
  return db
    .select()
    .from(schema.jobSource)
    .where(eq(schema.jobSource.userId, userId))
    .orderBy(desc(schema.jobSource.createdAt));
}

export async function getSource(id: string, userId: string): Promise<JobSourceRecord | null> {
  const [row] = await db
    .select()
    .from(schema.jobSource)
    .where(and(eq(schema.jobSource.id, id), eq(schema.jobSource.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createSource(input: {
  id: string;
  userId: string;
  kind: ConnectorKind;
  label: string;
  config: unknown;
}): Promise<JobSourceRecord> {
  const [row] = await db
    .insert(schema.jobSource)
    .values({
      id: input.id,
      userId: input.userId,
      kind: input.kind,
      label: input.label,
      config: input.config as object,
    })
    .returning();
  return row!;
}

export async function deleteSource(id: string, userId: string): Promise<void> {
  await db
    .delete(schema.jobSource)
    .where(and(eq(schema.jobSource.id, id), eq(schema.jobSource.userId, userId)));
}

export async function markSourcePolled(id: string, error?: string): Promise<void> {
  await db
    .update(schema.jobSource)
    .set({ lastPolledAt: new Date(), lastError: error ?? null, updatedAt: new Date() })
    .where(eq(schema.jobSource.id, id));
}

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/**
 * Insert postings new to (sourceId, externalId); update existing rows
 * with the latest title/location/description. Returns counts.
 */
export async function upsertPostings(
  sourceId: string,
  postings: NormalizedPosting[],
): Promise<UpsertResult> {
  if (postings.length === 0) return { inserted: 0, updated: 0 };

  // Drizzle's onConflictDoUpdate doesn't return inserted vs updated separately,
  // so we use raw SQL with `xmax = 0` trick to count true inserts.
  const values = postings.map((p) => ({
    sourceId,
    externalId: p.externalId,
    url: p.url,
    title: p.title,
    company: p.company,
    location: p.location ?? null,
    remote: p.remote,
    employmentType: p.employmentType ?? null,
    department: p.department ?? null,
    descriptionHtml: p.descriptionHtml ?? null,
    descriptionText: p.descriptionText ?? null,
    postedAt: p.postedAt ?? null,
    raw: p.raw,
    isAlternance: p.isAlternance ?? null,
    salaryMinEUR: p.salaryMinEUR ?? null,
    salaryMaxEUR: p.salaryMaxEUR ?? null,
    salaryPeriod: p.salaryPeriod ?? null,
    salaryRaw: p.salaryRaw ?? null,
    experienceRequiredMonths: p.experienceRequiredMonths ?? null,
    experienceLabel: p.experienceLabel ?? null,
    workContext: p.workContext ?? null,
    appellationLibelle: p.appellationLibelle ?? null,
    romeCode: p.romeCode ?? null,
    dateActualisation: p.dateActualisation ?? null,
    accessibleTH: p.accessibleTH ?? null,
    entrepriseAdaptee: p.entrepriseAdaptee ?? null,
    employeurHandiEngage: p.employeurHandiEngage ?? null,
    nombrePostes: p.nombrePostes ?? null,
  }));

  const result = await db
    .insert(schema.jobPosting)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.jobPosting.sourceId, schema.jobPosting.externalId],
      set: {
        url: sql`excluded.url`,
        title: sql`excluded.title`,
        company: sql`excluded.company`,
        location: sql`excluded.location`,
        remote: sql`excluded.remote`,
        employmentType: sql`excluded.employment_type`,
        department: sql`excluded.department`,
        descriptionHtml: sql`excluded.description_html`,
        descriptionText: sql`excluded.description_text`,
        postedAt: sql`excluded.posted_at`,
        raw: sql`excluded.raw`,
        isAlternance: sql`excluded.is_alternance`,
        salaryMinEUR: sql`excluded.salary_min_eur`,
        salaryMaxEUR: sql`excluded.salary_max_eur`,
        salaryPeriod: sql`excluded.salary_period`,
        salaryRaw: sql`excluded.salary_raw`,
        experienceRequiredMonths: sql`excluded.experience_required_months`,
        experienceLabel: sql`excluded.experience_label`,
        workContext: sql`excluded.work_context`,
        appellationLibelle: sql`excluded.appellation_libelle`,
        romeCode: sql`excluded.rome_code`,
        dateActualisation: sql`excluded.date_actualisation`,
        accessibleTH: sql`excluded.accessible_th`,
        entrepriseAdaptee: sql`excluded.entreprise_adaptee`,
        employeurHandiEngage: sql`excluded.employeur_handi_engage`,
        nombrePostes: sql`excluded.nombre_postes`,
      },
    })
    .returning({ id: schema.jobPosting.id, discoveredAt: schema.jobPosting.discoveredAt });

  // Heuristic: rows where discoveredAt is within the last 10 seconds are fresh inserts.
  const now = Date.now();
  const inserted = result.filter((r) => now - r.discoveredAt.getTime() < 10_000).length;
  return { inserted, updated: result.length - inserted };
}

export interface ListPostingsFilter {
  sourceId?: string;
  remote?: boolean;
  query?: string;
  minFit?: number;
  sort?: "discovered" | "fit";
  limit?: number;
  offset?: number;
  /** Drop postings where fit_score_breakdown.excluded = true (default false). */
  hideExcluded?: boolean;
  /** Filter on posting.employmentType (case-insensitive substring). */
  employmentType?: string;
  /** Filter on posting.location (case-insensitive substring). */
  location?: string;
  /** Drop postings where is_alternance = true. */
  hideAlternance?: boolean;
  /** Drop postings where llm_verdict = 'mismatch'. */
  hideLlmMismatch?: boolean;
}

export async function getPostingForUser(
  postingId: string,
  userId: string,
): Promise<JobPostingRecord | null> {
  const [row] = await db
    .select({ posting: schema.jobPosting })
    .from(schema.jobPosting)
    .innerJoin(schema.jobSource, eq(schema.jobPosting.sourceId, schema.jobSource.id))
    .where(and(eq(schema.jobPosting.id, postingId), eq(schema.jobSource.userId, userId)))
    .limit(1);
  return row?.posting ?? null;
}

export async function updatePostingFitScore(
  postingId: string,
  fitScore: number,
  breakdown: unknown = null,
  llm: { verdict: string; score: number } | null = null,
): Promise<void> {
  const patch: Partial<typeof schema.jobPosting.$inferInsert> = {
    fitScore,
    fitScoreBreakdown: breakdown as object | null,
  };
  if (llm) {
    patch.llmVerdict = llm.verdict;
    patch.llmScore = llm.score;
    patch.llmCheckedAt = new Date();
  }
  await db.update(schema.jobPosting).set(patch).where(eq(schema.jobPosting.id, postingId));
}

export async function listPostingsForUser(
  userId: string,
  filter: ListPostingsFilter = {},
): Promise<JobPostingRecord[]> {
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  const conditions = [eq(schema.jobSource.userId, userId)];
  if (filter.sourceId) conditions.push(eq(schema.jobPosting.sourceId, filter.sourceId));
  if (filter.remote === true) conditions.push(eq(schema.jobPosting.remote, true));
  if (typeof filter.minFit === "number") {
    conditions.push(sql`${schema.jobPosting.fitScore} >= ${filter.minFit}`);
  }
  if (filter.query) {
    const q = `%${filter.query.toLowerCase()}%`;
    conditions.push(
      sql`(lower(${schema.jobPosting.title}) like ${q} or lower(${schema.jobPosting.company}) like ${q} or lower(${schema.jobPosting.descriptionText}) like ${q})`,
    );
  }
  if (filter.hideExcluded) {
    conditions.push(
      sql`(${schema.jobPosting.fitScoreBreakdown} is null or (${schema.jobPosting.fitScoreBreakdown} ->> 'excluded') <> 'true')`,
    );
  }
  if (filter.employmentType) {
    const q = `%${filter.employmentType.toLowerCase()}%`;
    conditions.push(sql`lower(${schema.jobPosting.employmentType}) like ${q}`);
  }
  if (filter.hideAlternance) {
    conditions.push(
      sql`(${schema.jobPosting.isAlternance} is null or ${schema.jobPosting.isAlternance} = false)`,
    );
  }
  if (filter.hideLlmMismatch) {
    conditions.push(
      sql`(${schema.jobPosting.llmVerdict} is null or ${schema.jobPosting.llmVerdict} <> 'mismatch')`,
    );
  }
  if (filter.location) {
    const q = `%${filter.location.toLowerCase()}%`;
    conditions.push(sql`lower(${schema.jobPosting.location}) like ${q}`);
  }

  const orderBy =
    filter.sort === "fit"
      ? [sql`${schema.jobPosting.fitScore} desc nulls last`, desc(schema.jobPosting.discoveredAt)]
      : [desc(schema.jobPosting.discoveredAt)];

  const rows = await db
    .select({ posting: schema.jobPosting })
    .from(schema.jobPosting)
    .innerJoin(schema.jobSource, eq(schema.jobPosting.sourceId, schema.jobSource.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  return rows.map((r) => r.posting);
}
