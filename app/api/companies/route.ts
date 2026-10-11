import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { listCompaniesForUser } from "@/lib/companies/repository";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const min = url.searchParams.get("minHeadcount");
  const max = url.searchParams.get("maxHeadcount");

  const companies = await listCompaniesForUser(session.user.id, {
    query: url.searchParams.get("q") ?? undefined,
    activityCode: url.searchParams.get("activity") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    minHeadcount: min ? Number(min) : undefined,
    maxHeadcount: max ? Number(max) : undefined,
    limit: Number(url.searchParams.get("limit") ?? 100),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return NextResponse.json({ companies });
}
