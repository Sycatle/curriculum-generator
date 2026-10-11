/**
 * POST /api/companies/discover
 *
 * Body: {
 *   kind: "recherche-entreprises" | "apify-gmaps",
 *   config: <connector-specific>
 * }
 *
 * Triggers a synchronous discovery run against the chosen source and upserts
 * results into `company`. For now only `recherche-entreprises` is wired up.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { fetchCompaniesFromSource, getCompanyConnector } from "@/lib/companies/registry";
import { upsertCompanies } from "@/lib/companies/repository";
import type { CompanySourceKind } from "@/lib/companies/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  kind: z.enum(["recherche-entreprises", "apify-gmaps", "manual"]),
  config: z.unknown(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  try {
    const { configSchema } = getCompanyConnector(body.kind as CompanySourceKind);
    configSchema.parse(body.config);
  } catch (err) {
    return NextResponse.json(
      { error: `Config: ${err instanceof Error ? err.message : "invalid"}` },
      { status: 400 },
    );
  }

  try {
    const companies = await fetchCompaniesFromSource(body.kind as CompanySourceKind, body.config);
    const result = await upsertCompanies(session.user.id, companies);
    return NextResponse.json({ fetched: companies.length, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Discovery failed" },
      { status: 502 },
    );
  }
}
