/**
 * Refresh orchestration — fetches sources via the connector registry,
 * upserts postings, and records lastPolledAt / lastError. Reusable from
 * the manual per-source route, the user-scoped refresh-all, the stale
 * auto-refresh, and the system cron.
 */

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { fetchSource } from "./registry";
import {
  markSourcePolled,
  upsertPostings,
  type JobSourceRecord,
  type UpsertResult,
} from "./repository";

export interface RefreshOutcome {
  sourceId: string;
  ok: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  error?: string;
}

export interface RefreshSummary {
  total: number;
  ok: number;
  failed: number;
  fetched: number;
  inserted: number;
  updated: number;
  perSource: RefreshOutcome[];
}

export async function refreshSource(source: JobSourceRecord): Promise<RefreshOutcome> {
  try {
    const postings = await fetchSource(source.kind, source.config);
    const result: UpsertResult = await upsertPostings(source.id, postings);
    await markSourcePolled(source.id);
    return {
      sourceId: source.id,
      ok: true,
      fetched: postings.length,
      inserted: result.inserted,
      updated: result.updated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    await markSourcePolled(source.id, message);
    return { sourceId: source.id, ok: false, fetched: 0, inserted: 0, updated: 0, error: message };
  }
}

function summarize(outcomes: RefreshOutcome[]): RefreshSummary {
  return outcomes.reduce<RefreshSummary>(
    (acc, o) => {
      acc.total += 1;
      if (o.ok) acc.ok += 1;
      else acc.failed += 1;
      acc.fetched += o.fetched;
      acc.inserted += o.inserted;
      acc.updated += o.updated;
      acc.perSource.push(o);
      return acc;
    },
    { total: 0, ok: 0, failed: 0, fetched: 0, inserted: 0, updated: 0, perSource: [] },
  );
}

async function refreshMany(sources: JobSourceRecord[]): Promise<RefreshSummary> {
  if (sources.length === 0) return summarize([]);
  const settled = await Promise.allSettled(sources.map((s) => refreshSource(s)));
  const outcomes = settled.map((r, i): RefreshOutcome =>
    r.status === "fulfilled"
      ? r.value
      : {
          sourceId: sources[i]!.id,
          ok: false,
          fetched: 0,
          inserted: 0,
          updated: 0,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        },
  );
  return summarize(outcomes);
}

export async function refreshAllForUser(userId: string): Promise<RefreshSummary> {
  const sources = await db
    .select()
    .from(schema.jobSource)
    .where(and(eq(schema.jobSource.userId, userId), eq(schema.jobSource.enabled, true)));
  return refreshMany(sources);
}

export interface RefreshStaleOptions {
  cooldownMinutes: number;
}

export async function refreshStaleForUser(
  userId: string,
  opts: RefreshStaleOptions,
): Promise<RefreshSummary> {
  const cutoff = new Date(Date.now() - opts.cooldownMinutes * 60_000);
  const sources = await db
    .select()
    .from(schema.jobSource)
    .where(
      and(
        eq(schema.jobSource.userId, userId),
        eq(schema.jobSource.enabled, true),
        or(isNull(schema.jobSource.lastPolledAt), lt(schema.jobSource.lastPolledAt, cutoff)),
      ),
    );
  return refreshMany(sources);
}

export async function refreshAllActive(opts: RefreshStaleOptions): Promise<RefreshSummary> {
  const cutoff = new Date(Date.now() - opts.cooldownMinutes * 60_000);
  const sources = await db
    .select()
    .from(schema.jobSource)
    .where(
      and(
        eq(schema.jobSource.enabled, true),
        or(isNull(schema.jobSource.lastPolledAt), lt(schema.jobSource.lastPolledAt, cutoff)),
      ),
    )
    .orderBy(sql`${schema.jobSource.lastPolledAt} asc nulls first`);
  return refreshMany(sources);
}
