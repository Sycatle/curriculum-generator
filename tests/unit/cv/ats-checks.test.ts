import { describe, expect, it } from "vitest";
import { computeAtsScore, scoreBand } from "@/lib/cv/ats-checks";
import type { CvData } from "@/lib/cv/schema";

function baseCv(overrides: Partial<CvData> = {}): CvData {
  return {
    header: {
      name: "Jane Doe",
      title: "Senior Software Engineer",
      email: "jane@example.com",
      phone: undefined,
      location: "Paris",
      links: [{ label: "GitHub", href: "https://github.com/jane" }],
    },
    photoUrl: undefined,
    summary:
      "Senior backend engineer with 8 years building distributed systems at scale, focused on reliability and developer experience across payments infrastructure.",
    experiences: [
      {
        role: "Staff Engineer",
        company: "Acme",
        startDate: "2021-03",
        endDate: null,
        location: "Remote",
        summary: undefined,
        bullets: [
          "Built event-driven payments pipeline in Go, cutting p95 latency from 400 ms to 90 ms across 2M MAU.",
          "Led migration of 30+ services to Kubernetes, reducing infra cost by 35%.",
        ],
        stack: ["Go", "Kubernetes"],
      },
    ],
    projects: [],
    education: [
      {
        school: "EPITECH",
        degree: "MSc Computer Science",
        startDate: "2014-09",
        endDate: "2019-06",
        location: undefined,
        details: undefined,
      },
    ],
    skills: [
      { category: "Languages", items: ["Go", "TypeScript", "Python"] },
      { category: "Infra", items: ["Kubernetes", "Terraform", "AWS"] },
    ],
    languages: [],
    certifications: [],
    interests: [],
    ...overrides,
  };
}

describe("computeAtsScore", () => {
  it("returns high score for a clean CV", () => {
    const r = computeAtsScore(baseCv());
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(scoreBand(r.score)).toBe("high");
  });

  it("penalises missing email", () => {
    const r = computeAtsScore(baseCv({ header: { ...baseCv().header, email: undefined } }));
    expect(r.issues.some((i) => i.code === "missing.email")).toBe(true);
    expect(r.score).toBeLessThan(95);
  });

  it("flags photo presence", () => {
    const r = computeAtsScore(baseCv({ photoUrl: "https://example.com/me.jpg" }));
    expect(r.issues.some((i) => i.code === "photo.present")).toBe(true);
  });

  it("flags weak verbs in bullets", () => {
    const r = computeAtsScore(
      baseCv({
        experiences: [
          {
            ...baseCv().experiences[0]!,
            bullets: [
              "Helped with the payments service.",
              "Responsible for the migration to Kubernetes.",
            ],
          },
        ],
      }),
    );
    expect(r.issues.some((i) => i.code === "bullets.weak-verb")).toBe(true);
  });

  it("flags missing metrics", () => {
    const r = computeAtsScore(
      baseCv({
        experiences: [
          {
            ...baseCv().experiences[0]!,
            bullets: [
              "Built a payments pipeline.",
              "Migrated services to Kubernetes.",
              "Designed the new authentication layer.",
            ],
          },
        ],
      }),
    );
    expect(r.issues.some((i) => i.code === "bullets.no-metric")).toBe(true);
  });

  it("flags missing public link for tech role", () => {
    const cv = baseCv({
      header: { ...baseCv().header, links: [] },
    });
    const r = computeAtsScore(cv);
    expect(r.issues.some((i) => i.code === "missing.public-link")).toBe(true);
  });
});
