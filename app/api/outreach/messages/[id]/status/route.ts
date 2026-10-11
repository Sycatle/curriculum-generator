import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import {
  MANUAL_TRANSITIONS,
  setMessageStatus,
  type FunnelStatus,
} from "@/lib/outreach/repository";

export const runtime = "nodejs";

const Body = z.object({
  status: z.enum(["replied", "interview", "hired", "lost"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const status = body.status as FunnelStatus;
  if (!MANUAL_TRANSITIONS.has(status)) {
    return NextResponse.json({ error: "Status not allowed manually" }, { status: 400 });
  }

  const { id } = await params;
  const updated = await setMessageStatus(id, session.user.id, status);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ message: updated });
}
