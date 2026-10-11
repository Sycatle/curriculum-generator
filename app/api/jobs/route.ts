import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { listPostingsForUser } from "@/lib/jobs/repository";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const remoteParam = url.searchParams.get("remote");
  const postings = await listPostingsForUser(session.user.id, {
    sourceId: url.searchParams.get("source") ?? undefined,
    remote: remoteParam === "1" ? true : remoteParam === "0" ? false : undefined,
    query: url.searchParams.get("q") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 50),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });

  return NextResponse.json({ postings });
}
