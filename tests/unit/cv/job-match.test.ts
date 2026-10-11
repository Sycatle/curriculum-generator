import { describe, expect, it } from "vitest";
import { extractJobKeywords, matchKeywords } from "@/lib/cv/job-match";
import type { CvData } from "@/lib/cv/schema";

const JD = `
Senior Backend Engineer

We are looking for a senior backend engineer with experience in distributed
systems.

Requirements:
- Required: Strong experience with Go and Kubernetes.
- Required: Solid understanding of PostgreSQL and Redis.
- Required: Hands-on with AWS infrastructure.

Nice to have:
- Experience with Terraform.
- Familiarity with gRPC and Kafka.
`;

const CV: CvData = {
  header: {
    name: "Jane",
    title: "Backend Engineer",
    email: "jane@example.com",
    phone: undefined,
    location: undefined,
    links: [],
  },
  photoUrl: undefined,
  summary: "Backend engineer experienced in Go, PostgreSQL and AWS.",
  experiences: [
    {
      role: "Backend Engineer",
      company: "Acme",
      startDate: "2020-01",
      endDate: null,
      location: undefined,
      summary: undefined,
      bullets: ["Built payments services in Go on AWS, scaling to 1M req/day."],
      stack: ["Go", "Postgres", "AWS"],
    },
  ],
  projects: [],
  education: [],
  skills: [{ category: "Languages", items: ["Go", "Python"] }],
  languages: [],
  certifications: [],
  interests: [],
};

describe("extractJobKeywords", () => {
  it("extracts technical keywords", () => {
    const kws = extractJobKeywords(JD);
    const terms = kws.map((k) => k.term);
    expect(terms).toContain("go");
    expect(terms).toContain("kubernetes");
    expect(terms).toContain("aws");
  });

  it("flags must-have vs nice-to-have", () => {
    const kws = extractJobKeywords(JD);
    const k8s = kws.find((k) => k.term === "kubernetes");
    const terraform = kws.find((k) => k.term === "terraform");
    expect(k8s?.category).toBe("must-have");
    expect(terraform?.category).toBe("nice-to-have");
  });
});

describe("matchKeywords", () => {
  it("detects present keywords across sections", () => {
    const kws = extractJobKeywords(JD);
    const r = matchKeywords(CV, kws);
    const go = r.matches.find((m) => m.keyword.term === "go");
    expect(go?.status).not.toBe("missing");
  });

  it("flags missing must-have", () => {
    const kws = extractJobKeywords(JD);
    const r = matchKeywords(CV, kws);
    expect(r.gaps.some((g) => g.term === "kubernetes")).toBe(true);
  });

  it("coverage reflects must-have presence", () => {
    const kws = extractJobKeywords(JD);
    const r = matchKeywords(CV, kws);
    expect(r.coverage).toBeGreaterThan(0);
    expect(r.coverage).toBeLessThan(100);
  });
});
