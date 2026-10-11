/**
 * GET  /api/jobs/targeting → current user's profile (or null)
 * PUT  /api/jobs/targeting → upsert partial patch
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import {
  TargetingProfilePatchSchema,
  getTargetingProfile,
  upsertTargetingProfile,
} from "@/lib/jobs/targeting";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getTargetingProfile(session.user.id);
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let patch;
  try {
    patch = TargetingProfilePatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const profile = await upsertTargetingProfile(session.user.id, patch);
  return NextResponse.json({ profile });
}
