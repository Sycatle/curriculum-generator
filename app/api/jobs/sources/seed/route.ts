import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { seedSuggestedSources } from "@/lib/jobs/seed";
import { refreshAllForUser } from "@/lib/jobs/refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const seed = await seedSuggestedSources(session.user.id);
  const summary = await refreshAllForUser(session.user.id);

  return NextResponse.json({
    created: seed.created.map((s) => ({ id: s.id, label: s.label })),
    skipped: seed.skipped,
    refresh: { ok: summary.ok, failed: summary.failed, inserted: summary.inserted },
  });
}
