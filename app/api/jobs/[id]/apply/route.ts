/**
 * POST /api/jobs/[postingId]/apply
 *
 * Body: { cvId: string, coverLetterText?: string }
 *
 * Applies via the matching ATS API:
 *   - Greenhouse postings (source kind 'greenhouse') → submit via API
 *   - Other sources → 501 for now (Stagehand / email-only come later)
 *
 * Idempotent: one application per (user, posting). Returns 409 on retry.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { db, schema } from "@/lib/db/client";
import { CvDataSchema, ThemeSchema } from "@/lib/cv/schema";
import { getCvForUser } from "@/lib/cv/repository";
import { getPostingForUser } from "@/lib/jobs/repository";
import {
  createApplication,
  getApplicationByPosting,
  markApplicationFailed,
  markApplicationSubmitted,
} from "@/lib/jobs/applications/repository";
import { submitToGreenhouse } from "@/lib/jobs/submit/greenhouse-api";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  cvId: z.string().min(1),
  coverLetterText: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const posting = await getPostingForUser(id, session.user.id);
  if (!posting) return NextResponse.json({ error: "Posting not found" }, { status: 404 });

  // Idempotence: refuse a second application to the same posting.
  const existing = await getApplicationByPosting(session.user.id, id);
  if (existing) {
    return NextResponse.json(
      { error: "Already applied", application: existing },
      { status: 409 },
    );
  }

  const cv = await getCvForUser(body.cvId, session.user.id);
  if (!cv) return NextResponse.json({ error: "CV not found" }, { status: 404 });
  const cvData = CvDataSchema.parse(cv.data);
  const cvTheme = ThemeSchema.parse(cv.theme);

  // Resolve source kind via the source row attached to the posting.
  const [sourceRow] = await db
    .select()
    .from(schema.jobSource)
    .where(eq(schema.jobSource.id, posting.sourceId))
    .limit(1);
  if (!sourceRow) return NextResponse.json({ error: "Source missing" }, { status: 500 });

  if (sourceRow.kind !== "greenhouse") {
    return NextResponse.json(
      { error: `Auto-apply not yet supported for source kind '${sourceRow.kind}'` },
      { status: 501 },
    );
  }

  const cfg = sourceRow.config as { board?: string };
  if (!cfg.board) {
    return NextResponse.json({ error: "Greenhouse board missing in source config" }, { status: 500 });
  }

  const app = await createApplication({
    userId: session.user.id,
    postingId: id,
    cvId: body.cvId,
    submitStrategy: "greenhouse-api",
    coverLetterText: body.coverLetterText,
  });

  try {
    const result = await submitToGreenhouse({
      board: cfg.board,
      jobId: posting.externalId,
      cvData,
      cvTheme,
      locale: cv.locale === "fr" ? "fr" : "en",
      coverLetterText: body.coverLetterText ?? null,
    });
    if (!result.ok) {
      await markApplicationFailed(app.id, `Greenhouse HTTP ${result.status}`, result.body);
      return NextResponse.json(
        { error: `Greenhouse HTTP ${result.status}`, body: result.body, applicationId: app.id },
        { status: 502 },
      );
    }
    await markApplicationSubmitted(
      app.id,
      result.candidateId ? String(result.candidateId) : undefined,
      result.body,
    );
    return NextResponse.json({
      ok: true,
      applicationId: app.id,
      candidateId: result.candidateId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Submit failed";
    await markApplicationFailed(app.id, msg);
    return NextResponse.json({ error: msg, applicationId: app.id }, { status: 500 });
  }
}
