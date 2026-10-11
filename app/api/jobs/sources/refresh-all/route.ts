import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { refreshAllForUser } from "@/lib/jobs/refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await refreshAllForUser(session.user.id);
  return NextResponse.json({
    total: summary.total,
    ok: summary.ok,
    failed: summary.failed,
    inserted: summary.inserted,
    updated: summary.updated,
    fetched: summary.fetched,
    errors: summary.perSource
      .filter((s) => !s.ok)
      .map((s) => ({ sourceId: s.sourceId, error: s.error })),
  });
}
