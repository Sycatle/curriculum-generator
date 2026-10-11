import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { runBatch } from "@/lib/outreach/batch";
import { getMailboxStates } from "@/lib/outreach/mailboxes";
import { isResendConfigured } from "@/lib/outreach/resend-client";

export const runtime = "nodejs";
// Long-running: rate-limited sends can take minutes. On Vercel free this caps
// at 60s — set OUTREACH_BATCH_LIMIT accordingly. On self-host with Caddy,
// the upstream proxy_timeout matters.
export const maxDuration = 300;

const Body = z.object({
  cvId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
  onlyVerified: z.boolean().optional(),
  onlyRemoteFriendly: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function GET() {
  // Lightweight status: mailbox usage today.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mailboxes = await getMailboxStates(session.user.id);
  return NextResponse.json({
    resendConfigured: isResendConfigured(),
    mailboxes,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        error:
          "Resend not configured. Set RESEND_API_KEY and OUTREACH_FROM_ADDRESS(ES) in your environment.",
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

  const summary = await runBatch({
    userId: session.user.id,
    cvId: body.cvId,
    limit: body.limit,
    onlyVerified: body.onlyVerified,
    onlyRemoteFriendly: body.onlyRemoteFriendly,
    dryRun: body.dryRun,
  });
  return NextResponse.json(summary);
}
