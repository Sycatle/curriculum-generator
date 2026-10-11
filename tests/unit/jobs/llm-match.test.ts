/**
 * LLM matcher tests — Anthropic SDK is mocked so no network is hit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobPostingRecord } from "@/lib/jobs/repository";
import type { TargetingProfile } from "@/lib/jobs/targeting";

type CreateFn = (...args: unknown[]) => Promise<unknown>;
const createMock = vi.fn<CreateFn>();

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return {
    ...actual,
    getAnthropic: () => ({
      messages: { create: createMock },
    }),
  };
});

import { llmMatchBatch } from "@/lib/jobs/llm-match";

function posting(id: string, overrides: Partial<JobPostingRecord> = {}): JobPostingRecord {
  return {
    id,
    sourceId: "france-travail:test",
    externalId: id,
    url: "https://example.com/" + id,
    title: "Senior Software Engineer",
    company: "Acme",
    location: "Paris",
    remote: true,
    employmentType: "CDI",
    department: null,
    descriptionHtml: null,
    descriptionText: "TypeScript, React, Node. 5 ans XP. Full remote France.",
    postedAt: new Date(),
    fitScore: null,
    fitScoreBreakdown: null,
    isAlternance: false,
    salaryMinEUR: null,
    salaryMaxEUR: null,
    salaryPeriod: null,
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
    ...overrides,
  };
}

const profile: TargetingProfile = {
  userId: "u1",
  targetRoles: ["Senior"],
  mustHaveSkills: ["typescript"],
  niceSkills: [],
  excludeKeywords: [],
  targetLocations: ["Paris", "Remote EU"],
  excludeCompanies: [],
  remoteRequired: true,
  excludeAlternance: true,
  seniorityMin: 3,
  seniorityMax: 5,
  languages: { en: "nice" },
  employmentTypes: ["CDI"],
  salaryMinEUR: null,
  updatedAt: new Date(),
};

function toolResponse(input: object) {
  return {
    content: [{ type: "tool_use", name: "report_match", input }],
    usage: { input_tokens: 1200, cache_read_input_tokens: 1000, output_tokens: 150 },
  };
}

beforeEach(() => {
  createMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("llmMatchBatch", () => {
  it("parses tool_use into LlmMatchResult", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        score: 82,
        verdict: "fit",
        reasons: ["Stack TS/React match", "Full remote confirmé"],
        extracted: {
          actualSeniority: "senior",
          remotePolicy: "full-remote",
          languagesRequired: ["French"],
          realSalaryMinEUR: 55000,
          realSalaryMaxEUR: 70000,
          mainStack: ["typescript", "react"],
          isAlternance: false,
          dealbreakers: [],
        },
      }),
    );
    const out = await llmMatchBatch([posting("p1")], { profile, cvSummary: "..." });
    expect(out.size).toBe(1);
    const r = out.get("p1")!;
    expect(r.score).toBe(82);
    expect(r.verdict).toBe("fit");
    expect(r.reasons).toHaveLength(2);
    expect(r.extracted.actualSeniority).toBe("senior");
    expect(r.usage.cachedTokens).toBe(1000);
  });

  it("clamps score and falls back to 'stretch' on bad verdict", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        score: 150,
        verdict: "great",
        reasons: [],
        extracted: {
          actualSeniority: "unknown",
          remotePolicy: "unknown",
          languagesRequired: [],
          realSalaryMinEUR: null,
          realSalaryMaxEUR: null,
          mainStack: [],
          isAlternance: false,
          dealbreakers: [],
        },
      }),
    );
    const out = await llmMatchBatch([posting("p1")], { profile, cvSummary: "..." });
    const r = out.get("p1")!;
    expect(r.score).toBe(100);
    expect(r.verdict).toBe("stretch");
  });

  it("retries on 429 then succeeds", async () => {
    const e = new Error("rate limited") as Error & { status?: number };
    e.status = 429;
    createMock
      .mockRejectedValueOnce(e)
      .mockResolvedValueOnce(
        toolResponse({
          score: 60,
          verdict: "stretch",
          reasons: [],
          extracted: {
            actualSeniority: "mid",
            remotePolicy: "hybrid",
            languagesRequired: [],
            realSalaryMinEUR: null,
            realSalaryMaxEUR: null,
            mainStack: [],
            isAlternance: false,
            dealbreakers: [],
          },
        }),
      );
    const out = await llmMatchBatch([posting("p1")], { profile, cvSummary: "..." });
    expect(out.get("p1")?.verdict).toBe("stretch");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("returns empty map when posting fails after retries", async () => {
    const e = new Error("boom") as Error & { status?: number };
    e.status = 500;
    createMock.mockRejectedValue(e);
    const out = await llmMatchBatch([posting("p1")], { profile, cvSummary: "..." });
    expect(out.size).toBe(0);
  });

  it("processes multiple postings (concurrency cap honored)", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        score: 70,
        verdict: "fit",
        reasons: [],
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
      }),
    );
    const ps = Array.from({ length: 7 }, (_, i) => posting("p" + i));
    const out = await llmMatchBatch(ps, { profile, cvSummary: "..." }, { concurrency: 3 });
    expect(out.size).toBe(7);
    expect(createMock).toHaveBeenCalledTimes(7);
  });
});
