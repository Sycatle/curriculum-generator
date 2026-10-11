import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { getSource } from "@/lib/jobs/repository";
import { refreshSource } from "@/lib/jobs/refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const source = await getSource(id, session.user.id);
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!source.enabled) return NextResponse.json({ error: "Source disabled" }, { status: 400 });

  const outcome = await refreshSource(source);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error ?? "Refresh failed" }, { status: 502 });
  }
  return NextResponse.json({
    fetched: outcome.fetched,
    inserted: outcome.inserted,
    updated: outcome.updated,
  });
}
