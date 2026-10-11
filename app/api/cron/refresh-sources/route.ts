import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { refreshAllActive } from "@/lib/jobs/refresh";

export const runtime = "nodejs";
export const maxDuration = 300;

const COOLDOWN_MINUTES = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const expected = `Bearer ${secret}`;
  return safeEqual(header, expected);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await refreshAllActive({ cooldownMinutes: COOLDOWN_MINUTES });
  return NextResponse.json({
    total: summary.total,
    ok: summary.ok,
    failed: summary.failed,
    fetched: summary.fetched,
    inserted: summary.inserted,
    updated: summary.updated,
  });
}
