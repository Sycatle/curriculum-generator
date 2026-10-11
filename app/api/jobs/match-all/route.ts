/**
 * Batch matching — recompute fit_score for every posting against one CV.
 *
 * Pass 1 (deterministic, all postings) → fast keyword + profile dimensions.
 * Pass 2 (LLM, top-N by deterministic score) → reads description, extracts
 * real signals, returns verdict. Blended final score persisted.
 *
 * Query params:
 *   cvId (required)
 *   llm   — '0' to skip LLM pass; default = run when profile exists
 *   topN  — override LLM cap (default JOBS_LLM_MAX_PER_REQUEST=100)
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/server";
import { getCvForUser } from "@/lib/cv/repository";
import { db, schema } from "@/lib/db/client";
import { listPostingsForUser, updatePostingFitScore } from "@/lib/jobs/repository";
import { matchPostingFinal, matchPostingMulti } from "@/lib/jobs/matching";
import { getTargetingProfile } from "@/lib/jobs/targeting";
import { llmMatchBatch } from "@/lib/jobs/llm-match";
import { summarizeCvForMatch } from "@/lib/ai/cv-summary";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const cvId = url.searchParams.get("cvId");
  if (!cvId) return NextResponse.json({ error: "Missing cvId" }, { status: 400 });
  const useLlm = url.searchParams.get("llm") !== "0";
  const topNParam = Number(url.searchParams.get("topN") ?? "");
  const topN =
    Number.isFinite(topNParam) && topNParam > 0
      ? Math.min(500, Math.floor(topNParam))
      : Number(process.env.JOBS_LLM_MAX_PER_REQUEST ?? 100);
  const cacheDays = Number(process.env.JOBS_LLM_CACHE_DAYS ?? 30);

  const [cv, profile] = await Promise.all([
    getCvForUser(cvId, session.user.id),
    getTargetingProfile(session.user.id),
  ]);
  if (!cv) return NextResponse.json({ error: "CV not found" }, { status: 404 });

  const postings = await listPostingsForUser(session.user.id, { limit: 1000 });

  // Pass 1 — deterministic, all postings
  let scored = 0;
  let excludedDet = 0;
  const detByPostingId = new Map<string, ReturnType<typeof matchPostingMulti>>();
  for (const p of postings) {
    if (!p.descriptionText && !p.descriptionHtml && !p.title) continue;
    const det = matchPostingMulti(cv.data, p, profile);
    detByPostingId.set(p.id, det);
    // Persist det-only first so the user sees results immediately if LLM is off
    await updatePostingFitScore(p.id, det.total, det);
    scored++;
    if (det.excluded) excludedDet++;
  }

  if (!useLlm || !profile) {
    return NextResponse.json({
      scored,
      excluded: excludedDet,
      total: postings.length,
      llmCalled: 0,
      llmCached: 0,
    });
  }

  // Pass 2 — LLM on top N non-excluded, skipping recently-checked
  const cacheCutoff = new Date(Date.now() - cacheDays * 86_400_000);
  const candidates = postings
    .filter((p) => {
      const det = detByPostingId.get(p.id);
      if (!det || det.excluded) return false;
      if (p.llmCheckedAt && p.llmCheckedAt > cacheCutoff) return false;
      return true;
    })
    .sort((a, b) => {
      const sa = detByPostingId.get(a.id)?.total ?? 0;
      const sb = detByPostingId.get(b.id)?.total ?? 0;
      return sb - sa;
    })
    .slice(0, topN);

  const llmCached = postings.filter(
    (p) => p.llmCheckedAt && p.llmCheckedAt > cacheCutoff,
  ).length;

  if (candidates.length === 0) {
    return NextResponse.json({
      scored,
      excluded: excludedDet,
      total: postings.length,
      llmCalled: 0,
      llmCached,
    });
  }

  const cvSummary = summarizeCvForMatch(cv.data);
  const llmResults = await llmMatchBatch(candidates, { profile, cvSummary }, { concurrency: 5 });

  // Apply blended scoring on the LLM-matched postings
  let usageInput = 0;
  let usageCached = 0;
  let usageOutput = 0;
  let llmExcluded = 0;
  for (const p of candidates) {
    const llm = llmResults.get(p.id) ?? null;
    const final = matchPostingFinal(cv.data, p, profile, llm);
    await updatePostingFitScore(
      p.id,
      final.finalTotal,
      final,
      llm ? { verdict: llm.verdict, score: llm.score } : null,
    );
    if (final.excluded) llmExcluded++;
    if (llm) {
      usageInput += llm.usage.inputTokens;
      usageCached += llm.usage.cachedTokens;
      usageOutput += llm.usage.outputTokens;
    }
  }

  // Also re-run the blend on cached LLM postings so changes to profile/CV
  // propagate to the final score without spending another LLM call.
  let cachedRescored = 0;
  for (const p of postings) {
    if (!p.llmCheckedAt || p.llmCheckedAt <= cacheCutoff) continue;
    if (candidates.some((c) => c.id === p.id)) continue;
    if (p.llmVerdict == null || p.llmScore == null) continue;
    const det = detByPostingId.get(p.id);
    if (!det || det.excluded) continue;
    // Reconstruct a minimal LlmMatchResult for blending only
    const llmStub = {
      score: p.llmScore,
      verdict: p.llmVerdict as "fit" | "stretch" | "mismatch",
      reasons: [],
      extracted: {
        actualSeniority: "unknown" as const,
        remotePolicy: "unknown" as const,
        languagesRequired: [],
        realSalaryMinEUR: null,
        realSalaryMaxEUR: null,
        mainStack: [],
        isAlternance: false,
        dealbreakers: [],
      },
      usage: { inputTokens: 0, cachedTokens: 0, outputTokens: 0 },
      model: "cached",
    };
    const final = matchPostingFinal(cv.data, p, profile, llmStub);
    await updatePostingFitScore(p.id, final.finalTotal, final, {
      verdict: llmStub.verdict,
      score: llmStub.score,
    });
    cachedRescored++;
  }

  // Best-effort excluded count after LLM
  const [excludedRow] = await db
    .select({
      excludedNow: sql<number>`count(*) filter (where ${schema.jobPosting.fitScore} = -1)`,
    })
    .from(schema.jobPosting)
    .innerJoin(schema.jobSource, sql`${schema.jobPosting.sourceId} = ${schema.jobSource.id}`)
    .where(sql`${schema.jobSource.userId} = ${session.user.id}`);
  const excludedNow = excludedRow?.excludedNow ?? excludedDet;

  return NextResponse.json({
    scored,
    total: postings.length,
    excluded: Number(excludedNow),
    excludedDet,
    llmExcluded,
    llmCalled: llmResults.size,
    llmCached: cachedRescored,
    usage: { inputTokens: usageInput, cachedTokens: usageCached, outputTokens: usageOutput },
  });
}
