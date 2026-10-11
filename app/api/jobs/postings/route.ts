import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth/server";
import { db, schema } from "@/lib/db/client";
import { listPostingsForUser } from "@/lib/jobs/repository";

export const runtime = "nodejs";

const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sp = url.searchParams;

  const offset = Math.max(0, Number(sp.get("offset") ?? 0));
  const limitRaw = Number(sp.get("limit") ?? 50);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));

  const sort = sp.get("sort") === "fit" ? "fit" : "discovered";
  const minFitRaw = sp.get("minFit");
  const minFit = minFitRaw !== null && minFitRaw !== "" ? Number(minFitRaw) : undefined;
  const hideExcluded = sp.get("showExcluded") !== "1";

  const postings = await listPostingsForUser(session.user.id, {
    query: sp.get("q") ?? undefined,
    remote: sp.get("remote") === "1" ? true : undefined,
    sourceId: sp.get("source") ?? undefined,
    sort,
    minFit: typeof minFit === "number" && minFit > 0 ? minFit : undefined,
    hideExcluded,
    limit,
    offset,
  });

  // Lookups needed to render each row (kind for ApplyButton gating; existing apps)
  const sourceIds = Array.from(new Set(postings.map((p) => p.sourceId)));
  const [sources, apps] = await Promise.all([
    sourceIds.length
      ? db
          .select({ id: schema.jobSource.id, kind: schema.jobSource.kind })
          .from(schema.jobSource)
          .where(inArray(schema.jobSource.id, sourceIds))
      : Promise.resolve([] as { id: string; kind: string }[]),
    postings.length
      ? db
          .select({
            postingId: schema.jobApplication.postingId,
            status: schema.jobApplication.status,
          })
          .from(schema.jobApplication)
          .where(eq(schema.jobApplication.userId, session.user.id))
      : Promise.resolve([] as { postingId: string; status: string }[]),
  ]);

  const sourceKindById = Object.fromEntries(sources.map((s) => [s.id, s.kind]));
  const applicationByPostingId = Object.fromEntries(apps.map((a) => [a.postingId, a.status]));

  // Total count would require an extra query; instead the client treats
  // `postings.length < limit` as "end reached".
  return NextResponse.json({
    postings,
    sourceKindById,
    applicationByPostingId,
    hasMore: postings.length === limit,
  });
}

