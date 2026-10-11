import { describe, expect, it } from "vitest";
import { matchPostingFinal } from "@/lib/jobs/matching";
import { sampleCvData } from "@/lib/cv/sample";
import type { JobPostingRecord } from "@/lib/jobs/repository";
import type { TargetingProfile } from "@/lib/jobs/targeting";
import type { LlmMatchResult } from "@/lib/jobs/llm-match";

function posting(p: Partial<JobPostingRecord> & { title: string }): JobPostingRecord {
  return {
    id: "p1",
    sourceId: "s1",
    externalId: "e1",
    url: "https://example.com",
    title: p.title,
    company: p.company ?? "Acme",
    location: p.location ?? "Paris",
    remote: p.remote ?? true,
    employmentType: p.employmentType ?? "CDI",
    department: null,
    descriptionHtml: null,
    descriptionText: p.descriptionText ?? "TypeScript, React, full remote.",
    postedAt: null,
    fitScore: null,
    fitScoreBreakdown: null,
    isAlternance: p.isAlternance ?? null,
    salaryMinEUR: p.salaryMinEUR ?? null,
    salaryMaxEUR: p.salaryMaxEUR ?? null,
    salaryPeriod: p.salaryPeriod ?? null,
    salaryRaw: null,
    experienceRequiredMonths: null,
    experienceLabel: null,
    workContext: null,
    appellationLibelle: null,
    romeCode: null,
    dateActualisation: null,
    accessibleTH: null,
    entrepriseAdaptee: null,
    employeurHandiEngage: null,
    nombrePostes: null,
    llmVerdict: null,
    llmScore: null,
    llmCheckedAt: null,
    raw: {},
    discoveredAt: new Date(),
  };
}

function profile(patch: Partial<TargetingProfile> = {}): TargetingProfile {
  return {
    userId: "u",
    targetRoles: [],
    mustHaveSkills: [],
    niceSkills: [],
    excludeKeywords: [],
    targetLocations: [],
    excludeCompanies: [],
    remoteRequired: false,
    excludeAlternance: true,
    seniorityMin: null,
    seniorityMax: null,
    languages: {},
    employmentTypes: [],
    salaryMinEUR: null,
    updatedAt: new Date(),
    ...patch,
  };
}

function llm(score: number, verdict: LlmMatchResult["verdict"]): LlmMatchResult {
  return {
    score,
    verdict,
    reasons: ["mock"],
    extracted: {
      actualSeniority: "senior",
      remotePolicy: "full-remote",
      languagesRequired: [],
      realSalaryMinEUR: null,
      realSalaryMaxEUR: null,
      mainStack: [],
      isAlternance: false,
      dealbreakers: [],
    },
    usage: { inputTokens: 0, cachedTokens: 0, outputTokens: 0 },
    model: "mock",
  };
}

describe("matchPostingFinal", () => {
  it("falls back to deterministic when no LLM provided", () => {
    const r = matchPostingFinal(sampleCvData, posting({ title: "Senior" }), profile(), null);
    expect(r.llm).toBeNull();
    expect(r.finalTotal).toBe(r.total);
  });

  it("blends 0.4 × det + 0.6 × llm when both provided", () => {
    const r = matchPostingFinal(
      sampleCvData,
      posting({ title: "Senior Software Engineer" }),
      profile(),
      llm(100, "fit"),
    );
    // r.total now equals blended; det part is r.parts but legacy det total
    // is preserved in r.parts. Confirm blended is between 60 and 100.
    expect(r.finalTotal).toBeGreaterThanOrEqual(60);
    expect(r.finalTotal).toBeLessThanOrEqual(100);
    expect(r.excluded).toBe(false);
  });

  it("excludes when LLM verdict is mismatch", () => {
    const r = matchPostingFinal(
      sampleCvData,
      posting({ title: "Senior" }),
      profile(),
      llm(0, "mismatch"),
    );
    expect(r.excluded).toBe(true);
    expect(r.finalTotal).toBe(-1);
    expect(r.excludeReasons.join(" ")).toMatch(/LLM mismatch/);
  });

  it("excludes alternance flag when excludeAlternance=true", () => {
    const r = matchPostingFinal(
      sampleCvData,
      posting({ title: "Dev", isAlternance: true }),
      profile({ excludeAlternance: true }),
      null,
    );
    expect(r.excluded).toBe(true);
    expect(r.excludeReasons.join(" ")).toMatch(/alternance/);
  });

  it("keeps alternance posting when excludeAlternance=false", () => {
    const r = matchPostingFinal(
      sampleCvData,
      posting({ title: "Dev", isAlternance: true }),
      profile({ excludeAlternance: false }),
      null,
    );
    expect(r.excluded).toBe(false);
  });

  it("excludes when yearly salary max is below profile floor", () => {
    const r = matchPostingFinal(
      sampleCvData,
      posting({
        title: "Dev",
        salaryMinEUR: 30000,
        salaryMaxEUR: 35000,
        salaryPeriod: "year",
      }),
      profile({ salaryMinEUR: 50000 }),
      null,
    );
    expect(r.excluded).toBe(true);
    expect(r.excludeReasons.join(" ")).toMatch(/salary/);
  });

  it("does not exclude on salary when period is not 'year' (unknown unit)", () => {
    const r = matchPostingFinal(
      sampleCvData,
      posting({
        title: "Dev",
        salaryMinEUR: 2500,
        salaryMaxEUR: 3000,
        salaryPeriod: "month",
      }),
      profile({ salaryMinEUR: 50000 }),
      null,
    );
    expect(r.excluded).toBe(false);
  });

  it("preserves deterministic exclusion (LLM not allowed to un-exclude)", () => {
    const r = matchPostingFinal(
      sampleCvData,
      posting({ title: "PHP Developer", descriptionText: "PHP, Symfony" }),
      profile({ excludeKeywords: ["php"] }),
      llm(95, "fit"),
    );
    expect(r.excluded).toBe(true);
  });
});
