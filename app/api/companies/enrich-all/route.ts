/**
 * Batch enrichment — runs the pipeline for every company not yet enriched
 * (no contacts attached). Sequential with a short cool-down to be polite
 * to upstream APIs (Dropcontact + the companies' homepages).
 *
 * Use it after a discovery run. Long-running — call it as a background task
 * from the UI and poll.
 */

import { NextResponse } from "next/server";
import { and, eq, notExists } from "drizzle-orm";
import { getSession } from "@/lib/auth/server";
import { db, schema } from "@/lib/db/client";
import { enrichCompany } from "@/lib/companies/enrich/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);
  const onlyUnenriched = url.searchParams.get("all") !== "1";

  const rows = await db
    .select()
    .from(schema.company)
    .where(
      and(
        eq(schema.company.userId, session.user.id),
        onlyUnenriched
          ? notExists(
              db
                .select({ id: schema.contact.id })
                .from(schema.contact)
                .where(eq(schema.contact.companyId, schema.company.id)),
            )
          : undefined,
      ),
    )
    .limit(limit);

  const summary: Array<{ companyId: string; inserted: number; lang: string | null; notes: string[] }> = [];
  for (const company of rows) {
    try {
      const result = await enrichCompany(company);
      summary.push({
        companyId: company.id,
        inserted: result.upsert.inserted,
        lang: result.langDetected,
        notes: result.notes,
      });
    } catch (err) {
      summary.push({
        companyId: company.id,
        inserted: 0,
        lang: null,
        notes: [`error: ${err instanceof Error ? err.message : "unknown"}`],
      });
    }
    await sleep(500);
  }

  return NextResponse.json({ processed: rows.length, summary });
}
