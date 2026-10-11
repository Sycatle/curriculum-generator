import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { sendOutreach } from "@/lib/outreach/pipeline";
import { isResendConfigured } from "@/lib/outreach/resend-client";

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

  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        error:
          "Resend not configured. Set RESEND_API_KEY and OUTREACH_FROM_ADDRESS in your environment.",
      },
      { status: 503 },
    );
  }

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
    });
    const httpStatus = result.status === "sent" ? 200 : result.status === "skipped" ? 200 : 500;
    return NextResponse.json(result, { status: httpStatus });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 },
    );
  }
}
