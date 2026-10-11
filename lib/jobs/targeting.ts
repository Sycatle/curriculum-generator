/**
 * Targeting profile repository + Zod schema.
 *
 * One row per user. Drives `matchPostingMulti` in lib/jobs/matching.ts:
 * the profile encodes what the user is LOOKING FOR (full remote, target
 * cities, seniority, exclude keywords, languages…), which the CV alone
 * doesn't express.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/client";
import type { TargetingProfile } from "@/lib/db/schema";

export type { TargetingProfile };

/** 0=intern, 1=junior, 2=mid, 3=senior, 4=lead, 5=staff/principal */
export const SENIORITY_LABELS = ["Intern", "Junior", "Mid", "Senior", "Lead", "Staff"] as const;

export const LanguagesSchema = z.object({
  fr: z.enum(["required", "nice"]).optional(),
  en: z.enum(["required", "nice"]).optional(),
});

export const TargetingProfilePatchSchema = z.object({
  targetRoles: z.array(z.string()).optional(),
  mustHaveSkills: z.array(z.string()).optional(),
  niceSkills: z.array(z.string()).optional(),
  excludeKeywords: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  excludeCompanies: z.array(z.string()).optional(),
  remoteRequired: z.boolean().optional(),
  excludeAlternance: z.boolean().optional(),
  seniorityMin: z.number().int().min(0).max(5).nullable().optional(),
  seniorityMax: z.number().int().min(0).max(5).nullable().optional(),
  languages: LanguagesSchema.optional(),
  employmentTypes: z.array(z.string()).optional(),
  salaryMinEUR: z.number().int().min(0).nullable().optional(),
});

export type TargetingProfilePatch = z.infer<typeof TargetingProfilePatchSchema>;

export async function getTargetingProfile(userId: string): Promise<TargetingProfile | null> {
  const [row] = await db
    .select()
    .from(schema.targetingProfile)
    .where(eq(schema.targetingProfile.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertTargetingProfile(
  userId: string,
  patch: TargetingProfilePatch,
): Promise<TargetingProfile> {
  const now = new Date();
  const [row] = await db
    .insert(schema.targetingProfile)
    .values({
      userId,
      targetRoles: patch.targetRoles ?? [],
      mustHaveSkills: patch.mustHaveSkills ?? [],
      niceSkills: patch.niceSkills ?? [],
      excludeKeywords: patch.excludeKeywords ?? [],
      targetLocations: patch.targetLocations ?? [],
      excludeCompanies: patch.excludeCompanies ?? [],
      remoteRequired: patch.remoteRequired ?? false,
      excludeAlternance: patch.excludeAlternance ?? true,
      seniorityMin: patch.seniorityMin ?? null,
      seniorityMax: patch.seniorityMax ?? null,
      languages: patch.languages ?? {},
      employmentTypes: patch.employmentTypes ?? [],
      salaryMinEUR: patch.salaryMinEUR ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.targetingProfile.userId,
      set: {
        ...(patch.targetRoles !== undefined && { targetRoles: patch.targetRoles }),
        ...(patch.mustHaveSkills !== undefined && { mustHaveSkills: patch.mustHaveSkills }),
        ...(patch.niceSkills !== undefined && { niceSkills: patch.niceSkills }),
        ...(patch.excludeKeywords !== undefined && { excludeKeywords: patch.excludeKeywords }),
        ...(patch.targetLocations !== undefined && { targetLocations: patch.targetLocations }),
        ...(patch.excludeCompanies !== undefined && { excludeCompanies: patch.excludeCompanies }),
        ...(patch.remoteRequired !== undefined && { remoteRequired: patch.remoteRequired }),
        ...(patch.excludeAlternance !== undefined && { excludeAlternance: patch.excludeAlternance }),
        ...(patch.seniorityMin !== undefined && { seniorityMin: patch.seniorityMin }),
        ...(patch.seniorityMax !== undefined && { seniorityMax: patch.seniorityMax }),
        ...(patch.languages !== undefined && { languages: patch.languages }),
        ...(patch.employmentTypes !== undefined && { employmentTypes: patch.employmentTypes }),
        ...(patch.salaryMinEUR !== undefined && { salaryMinEUR: patch.salaryMinEUR }),
        updatedAt: now,
      },
    })
    .returning();
  return row!;
}

export async function deleteTargetingProfile(userId: string): Promise<void> {
  await db.delete(schema.targetingProfile).where(eq(schema.targetingProfile.userId, userId));
}
