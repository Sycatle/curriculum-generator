import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { createSource, listSources } from "@/lib/jobs/repository";
import { getConnector } from "@/lib/jobs/registry";
import type { ConnectorKind } from "@/lib/jobs/schema";

export const runtime = "nodejs";

const CreateBody = z.object({
  id: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9:_-]+$/i, "id must be ascii / : - _ only"),
  kind: z.enum(["greenhouse", "lever", "ashby", "workday", "france-travail", "hn", "remoteok"]),
  label: z.string().min(1).max(120),
  config: z.unknown(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sources = await listSources(session.user.id);
  return NextResponse.json({ sources });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Validate config against the connector's schema
  try {
    const { configSchema } = getConnector(body.kind as ConnectorKind);
    configSchema.parse(body.config);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid config";
    return NextResponse.json({ error: `Config: ${message}` }, { status: 400 });
  }

  try {
    const source = await createSource({
      id: body.id,
      userId: session.user.id,
      kind: body.kind as ConnectorKind,
      label: body.label,
      config: body.config,
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      return NextResponse.json(
        { error: `L'identifiant "${body.id}" est déjà utilisé. Choisis-en un autre ou supprime la source existante.` },
        { status: 409 },
      );
    }
    const message = err instanceof Error ? err.message : "Insert failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
