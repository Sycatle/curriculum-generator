import { describe, expect, it } from "vitest";
import { computeAtsScore, scoreBand, totalExperienceMonths } from "@/lib/cv/ats-checks";
import type { CvData } from "@/lib/cv/schema";

const NOW = new Date(2026, 5, 15); // juin 2026

function exp(
  company: string,
  startDate: string,
  endDate: string | null,
  overrides: Partial<CvData["experiences"][number]> = {},
): CvData["experiences"][number] {
  return {
    role: "Developer",
    company,
    startDate,
    endDate,
    location: undefined,
    summary: undefined,
    bullets: ["Built a service handling 2M requests."],
    stack: ["Go"],
    ...overrides,
  };
}

const codes = (cv: CvData) => computeAtsScore(cv, NOW).issues.map((i) => i.code);

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
        stack: ["Go", "TypeScript", "Python", "Kubernetes", "Terraform", "AWS"],
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

  it("does not flag a clean CV with the new checks", () => {
    const c = codes(baseCv());
    for (const code of [
      "header.no-title",
      "header.no-location",
      "dates.end-before-start",
      "dates.gap",
      "dates.overlap",
      "skills.unproven",
      "experiences.no-stack",
    ])
      expect(c).not.toContain(code);
  });

  it("flags missing header location and title", () => {
    const c = codes(baseCv({ header: { ...baseCv().header, location: undefined, title: " " } }));
    expect(c).toContain("header.no-location");
    expect(c).toContain("header.no-title");
  });

  it("flags an end date before the start date", () => {
    const c = codes(baseCv({ experiences: [exp("Acme", "2022-05", "2021-01")] }));
    expect(c).toContain("dates.end-before-start");
  });

  it("accepts same-year year-only dates", () => {
    const c = codes(baseCv({ experiences: [exp("Acme", "2020", "2020")] }));
    expect(c).not.toContain("dates.end-before-start");
  });

  it("flags a gap longer than 6 months but not a shorter one", () => {
    const gap = codes(
      baseCv({ experiences: [exp("A", "2018-01", "2019-01"), exp("B", "2019-09", null)] }),
    );
    expect(gap).toContain("dates.gap"); // févr.→août = 7 mois
    const ok = codes(
      baseCv({ experiences: [exp("A", "2018-01", "2019-01"), exp("B", "2019-08", null)] }),
    );
    expect(ok).not.toContain("dates.gap"); // 6 mois
  });

  it("reports overlaps as info without penalty", () => {
    const base = computeAtsScore(baseCv({ experiences: [exp("A", "2020-01", "2021-01")] }), NOW);
    const r = computeAtsScore(
      baseCv({ experiences: [exp("A", "2020-01", "2021-01"), exp("B", "2020-06", "2021-06")] }),
      NOW,
    );
    const overlap = r.issues.find((i) => i.code === "dates.overlap");
    expect(overlap?.severity).toBe("info");
    expect(overlap?.impact).toBe(0);
    expect(r.issues.some((i) => i.code === "dates.gap")).toBe(false);
    expect(r.score).toBe(base.score);
  });

  it("does not report a one-month handover as an overlap", () => {
    const c = codes(
      baseCv({ experiences: [exp("A", "2020-01", "2021-03"), exp("B", "2021-03", null)] }),
    );
    expect(c).not.toContain("dates.overlap");
  });

  it("flags skills not proven by any experience or project", () => {
    const cv = baseCv({
      skills: [{ category: "Stack", items: ["Go", "Node.js", "Rust", "C++", "Vue.js"] }],
      experiences: [
        exp("Acme", "2020-01", null, {
          bullets: ["Built APIs with NodeJS serving 2M users."],
          stack: ["Go"],
        }),
      ],
      projects: [{ name: "Side", description: "Tiny CLI", stack: ["vue"] }],
    });
    const issue = computeAtsScore(cv, NOW).issues.find((i) => i.code === "skills.unproven");
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("Rust");
    expect(issue?.message).toContain("C++");
    expect(issue?.message).not.toMatch(/Node\.js|Vue\.js|\bGo\b/);
  });

  it("matches skills on whole words only", () => {
    const cv = baseCv({
      skills: [{ category: "Stack", items: ["Java", "R"] }],
      experiences: [exp("Acme", "2020-01", null, { bullets: ["Wrote JavaScript for 10 teams."], stack: ["Go"] })],
    });
    const issue = computeAtsScore(cv, NOW).issues.find((i) => i.code === "skills.unproven");
    expect(issue?.message).toContain("Java,");
    expect(issue?.message).toContain("R.");
  });

  it("flags experiences without a stack", () => {
    const c = computeAtsScore(baseCv({ experiences: [exp("Acme", "2020-01", null, { stack: [] })] }), NOW);
    expect(c.issues.some((i) => i.code === "experiences.no-stack")).toBe(true);
  });
});

describe("totalExperienceMonths", () => {
  it("sums inclusive months", () => {
    const cv = baseCv({ experiences: [exp("A", "2020-01", "2020-12")] });
    expect(totalExperienceMonths(cv, NOW)).toBe(12);
  });

  it("counts overlaps once (union)", () => {
    const cv = baseCv({
      experiences: [exp("A", "2020-01", "2020-12"), exp("B", "2020-07", "2021-06")],
    });
    expect(totalExperienceMonths(cv, NOW)).toBe(18); // 2020-01 → 2021-06, pas 12 + 12
  });

  it("treats a null endDate as now", () => {
    const cv = baseCv({ experiences: [exp("A", "2026-01", null)] });
    expect(totalExperienceMonths(cv, NOW)).toBe(6);
  });

  it("ignores reversed or malformed periods", () => {
    const cv = baseCv({
      experiences: [exp("A", "2022-05", "2021-01"), exp("B", "bad", null), exp("C", "2020-01", "2020-03")],
    });
    expect(totalExperienceMonths(cv, NOW)).toBe(3);
  });
});
