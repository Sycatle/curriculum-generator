import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { refreshStaleForUser } from "@/lib/jobs/refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

const COOLDOWN_MINUTES = 30;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await refreshStaleForUser(session.user.id, {
    cooldownMinutes: COOLDOWN_MINUTES,
  });
  return NextResponse.json({
    total: summary.total,
    ok: summary.ok,
    failed: summary.failed,
    inserted: summary.inserted,
  });
}
