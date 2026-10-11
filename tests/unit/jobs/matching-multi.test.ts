/**
 * Multi-dimensional scoring tests — exercises the seven scoring dimensions
 * and the hard-exclusion path used by `/jobs` to filter the listing.
 */

import { describe, expect, it } from "vitest";
import { matchPostingMulti } from "@/lib/jobs/matching";
import { sampleCvData } from "@/lib/cv/sample";
import type { JobPostingRecord } from "@/lib/jobs/repository";
import type { TargetingProfile } from "@/lib/jobs/targeting";

function posting(partial: Partial<JobPostingRecord> & { title: string }): JobPostingRecord {
  return {
    id: partial.id ?? "00000000-0000-0000-0000-000000000001",
    sourceId: partial.sourceId ?? "greenhouse:acme",
    externalId: partial.externalId ?? "ext-1",
    url: partial.url ?? "https://example.com/job",
    title: partial.title,
    company: partial.company ?? "Acme",
    location: partial.location ?? null,
    remote: partial.remote ?? false,
    employmentType: partial.employmentType ?? null,
    department: partial.department ?? null,
    descriptionHtml: partial.descriptionHtml ?? null,
    descriptionText: partial.descriptionText ?? "TypeScript, React, PostgreSQL, AWS.",
    postedAt: partial.postedAt ?? null,
    fitScore: partial.fitScore ?? null,
    fitScoreBreakdown: partial.fitScoreBreakdown ?? null,
    isAlternance: partial.isAlternance ?? null,
    salaryMinEUR: partial.salaryMinEUR ?? null,
    salaryMaxEUR: partial.salaryMaxEUR ?? null,
    salaryPeriod: partial.salaryPeriod ?? null,
    salaryRaw: partial.salaryRaw ?? null,
    experienceRequiredMonths: partial.experienceRequiredMonths ?? null,
    experienceLabel: partial.experienceLabel ?? null,
    workContext: partial.workContext ?? null,
    appellationLibelle: partial.appellationLibelle ?? null,
    romeCode: partial.romeCode ?? null,
    dateActualisation: partial.dateActualisation ?? null,
    accessibleTH: partial.accessibleTH ?? null,
    entrepriseAdaptee: partial.entrepriseAdaptee ?? null,
    employeurHandiEngage: partial.employeurHandiEngage ?? null,
    nombrePostes: partial.nombrePostes ?? null,
    llmVerdict: partial.llmVerdict ?? null,
    llmScore: partial.llmScore ?? null,
    llmCheckedAt: partial.llmCheckedAt ?? null,
    raw: partial.raw ?? {},
    discoveredAt: partial.discoveredAt ?? new Date(),
  };
}

function profile(patch: Partial<TargetingProfile> = {}): TargetingProfile {
  return {
    userId: "user-1",
    targetRoles: patch.targetRoles ?? [],
    mustHaveSkills: patch.mustHaveSkills ?? [],
    niceSkills: patch.niceSkills ?? [],
    excludeKeywords: patch.excludeKeywords ?? [],
    targetLocations: patch.targetLocations ?? [],
    excludeCompanies: patch.excludeCompanies ?? [],
    remoteRequired: patch.remoteRequired ?? false,
    seniorityMin: patch.seniorityMin ?? null,
    seniorityMax: patch.seniorityMax ?? null,
    languages: patch.languages ?? {},
    employmentTypes: patch.employmentTypes ?? [],
    salaryMinEUR: patch.salaryMinEUR ?? null,
    excludeAlternance: patch.excludeAlternance ?? true,
    updatedAt: new Date(),
  };
}

describe("matchPostingMulti", () => {
  it("falls back to keyword-coverage when no profile is set", () => {
    const out = matchPostingMulti(sampleCvData, posting({ title: "Senior Engineer" }), null);
    expect(out.excluded).toBe(false);
    expect(out.total).toBeGreaterThanOrEqual(0);
    expect(out.total).toBeLessThanOrEqual(100);
    // parts.keywords mirrors the legacy single-dim score when profile is null.
    expect(out.parts.location).toBe(0);
    expect(out.parts.remote).toBe(0);
  });

  it("hard-rejects when excludeKeywords matches in title or description", () => {
    const out = matchPostingMulti(
      sampleCvData,
      posting({ title: "Senior PHP Developer", descriptionText: "Symfony, Laravel" }),
      profile({ excludeKeywords: ["php"] }),
    );
    expect(out.excluded).toBe(true);
    expect(out.total).toBe(-1);
    expect(out.excludeReasons.join(" ")).toMatch(/php/i);
  });

  it("hard-rejects on-site posting when remoteRequired is true", () => {
    const out = matchPostingMulti(
      sampleCvData,
      posting({ title: "Engineer", remote: false }),
      profile({ remoteRequired: true }),
    );
    expect(out.excluded).toBe(true);
    expect(out.excludeReasons[0]).toMatch(/remote required/i);
  });

  it("scores location 20/20 for an exact target city match", () => {
    const out = matchPostingMulti(
      sampleCvData,
      posting({ title: "Engineer", location: "Paris, France", remote: false }),
      profile({ targetLocations: ["Paris", "Lyon"] }),
    );
    expect(out.parts.location).toBe(20);
  });

  it("scores location 20/20 when posting is remote AND a Remote-* target is set", () => {
    const out = matchPostingMulti(
      sampleCvData,
      posting({ title: "Engineer", location: "Anywhere", remote: true }),
      profile({ targetLocations: ["Remote EU", "Remote US"] }),
    );
    expect(out.parts.location).toBe(20);
  });

  it("excludes when seniority is too low and the title says so", () => {
    const out = matchPostingMulti(
      sampleCvData,
      posting({ title: "Junior JavaScript Developer", remote: true }),
      profile({ seniorityMin: 3 }),
    );
    expect(out.excluded).toBe(true);
    expect(out.excludeReasons.join(" ")).toMatch(/seniority/i);
  });

  it("hard-rejects when a required language is absent from the JD", () => {
    const out = matchPostingMulti(
      sampleCvData,
      posting({
        title: "Engineer",
        remote: true,
        descriptionText: "Looking for someone who can ship.",
      }),
      profile({ languages: { en: "required" } }),
    );
    expect(out.excluded).toBe(true);
    expect(out.excludeReasons.join(" ")).toMatch(/EN/i);
  });

  it("awards role points when targetRoles match the title", () => {
    const out = matchPostingMulti(
      sampleCvData,
      posting({ title: "Staff Software Engineer", remote: true }),
      profile({
        targetRoles: ["Staff", "Senior Fullstack"],
        targetLocations: ["Remote EU"],
      }),
    );
    expect(out.excluded).toBe(false);
    expect(out.parts.role).toBe(5);
  });

  it("returns a bounded composite score [0,100] when all dimensions score", () => {
    const out = matchPostingMulti(
      sampleCvData,
      posting({
        title: "Senior TypeScript Engineer",
        company: "Acme",
        remote: true,
        location: "Paris, France",
        employmentType: "Full-time",
        descriptionText: "TypeScript, Node, React, PostgreSQL, AWS. English required.",
      }),
      profile({
        targetRoles: ["Senior"],
        targetLocations: ["Paris", "Remote EU"],
        remoteRequired: true,
        seniorityMin: 3,
        seniorityMax: 5,
        languages: { en: "required" },
        employmentTypes: ["Full-time"],
      }),
    );
    expect(out.excluded).toBe(false);
    expect(out.total).toBeGreaterThan(0);
    expect(out.total).toBeLessThanOrEqual(100);
  });
});
