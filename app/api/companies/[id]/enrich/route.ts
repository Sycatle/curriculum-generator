import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { getCompanyForUser } from "@/lib/companies/repository";
import { enrichCompany } from "@/lib/companies/enrich/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const company = await getCompanyForUser(id, session.user.id);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await enrichCompany(company);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrich failed" },
      { status: 502 },
    );
  }
}
