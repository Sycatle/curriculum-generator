import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { getCvForUser } from "@/lib/cv/repository";
import { getPostingForUser, updatePostingFitScore } from "@/lib/jobs/repository";
import { matchPostingMulti } from "@/lib/jobs/matching";
import { getTargetingProfile } from "@/lib/jobs/targeting";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const cvId = url.searchParams.get("cvId");
  if (!cvId) return NextResponse.json({ error: "Missing cvId" }, { status: 400 });

  const [posting, cv, profile] = await Promise.all([
    getPostingForUser(id, session.user.id),
    getCvForUser(cvId, session.user.id),
    getTargetingProfile(session.user.id),
  ]);
  if (!posting) return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  if (!cv) return NextResponse.json({ error: "CV not found" }, { status: 404 });

  if (!posting.descriptionText && !posting.descriptionHtml && !posting.title) {
    return NextResponse.json({ error: "Posting has nothing to match against" }, { status: 422 });
  }

  const breakdown = matchPostingMulti(cv.data, posting, profile);
  await updatePostingFitScore(id, breakdown.total, breakdown);

  return NextResponse.json({ id, ...breakdown });
}
