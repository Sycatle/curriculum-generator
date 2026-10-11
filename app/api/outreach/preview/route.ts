import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { sendOutreach } from "@/lib/outreach/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  cvId: z.string().min(1),
  contactId: z.string().min(1),
  lang: z.enum(["fr", "en"]).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  try {
    const result = await sendOutreach({
      userId: session.user.id,
      cvId: body.cvId,
      contactId: body.contactId,
      langOverride: body.lang,
      dryRun: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed" },
      { status: 500 },
    );
  }
}
