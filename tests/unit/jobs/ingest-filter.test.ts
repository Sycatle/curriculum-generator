/**
 * Ingest filter tests — verifies that the shared drop-at-source helper
 * correctly applies titleInclude/exclude regex, remoteOnly, and the
 * critical-for-HN requireStackKeywords list.
 */

import { describe, expect, it } from "vitest";
import { applyIngestFilter } from "@/lib/jobs/sources/ingest-filter";
import type { NormalizedPosting } from "@/lib/jobs/schema";

function p(
  partial: Partial<NormalizedPosting> & { title: string },
): NormalizedPosting {
  return {
    externalId: partial.externalId ?? partial.title.toLowerCase().replace(/\s+/g, "-"),
    url: partial.url ?? "https://example.com/job",
    title: partial.title,
    company: partial.company ?? "Acme",
    location: partial.location ?? null,
    remote: partial.remote ?? false,
    employmentType: partial.employmentType ?? null,
    department: partial.department ?? null,
    descriptionHtml: partial.descriptionHtml ?? null,
    descriptionText: partial.descriptionText ?? null,
    postedAt: partial.postedAt ?? null,
    raw: partial.raw ?? {},
  };
}

describe("applyIngestFilter", () => {
  const sample = [
    p({ title: "Senior TypeScript Engineer", remote: true, descriptionText: "TypeScript + Node" }),
    p({ title: "Stage — Développeur PHP", remote: false, descriptionText: "PHP intern" }),
    p({ title: "Staff Software Engineer", remote: true, descriptionText: "Python and AWS" }),
    p({ title: "Sales Manager", remote: true, descriptionText: "B2B SaaS sales" }),
  ];

  it("returns the input unchanged when filter is undefined", () => {
    expect(applyIngestFilter(sample, undefined)).toHaveLength(sample.length);
  });

  it("returns the input unchanged when filter is empty", () => {
    expect(applyIngestFilter(sample, {})).toHaveLength(sample.length);
  });

  it("remoteOnly drops on-site postings", () => {
    const out = applyIngestFilter(sample, { remoteOnly: true });
    expect(out).toHaveLength(3);
    expect(out.every((p) => p.remote)).toBe(true);
  });

  it("titleExcludeRegex drops matching titles (case-insensitive)", () => {
    const out = applyIngestFilter(sample, { titleExcludeRegex: "stage|php" });
    expect(out.map((p) => p.title)).not.toContain("Stage — Développeur PHP");
    expect(out).toHaveLength(3);
  });

  it("titleIncludeRegex keeps only matching titles", () => {
    const out = applyIngestFilter(sample, { titleIncludeRegex: "engineer" });
    expect(out).toHaveLength(2);
    expect(out.every((p) => /engineer/i.test(p.title))).toBe(true);
  });

  it("requireStackKeywords keeps postings mentioning any keyword in title+desc (HN case)", () => {
    const out = applyIngestFilter(sample, { requireStackKeywords: ["typescript", "python"] });
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.title)).toEqual(
      expect.arrayContaining(["Senior TypeScript Engineer", "Staff Software Engineer"]),
    );
  });

  it("combines all filters (AND)", () => {
    const out = applyIngestFilter(sample, {
      remoteOnly: true,
      titleExcludeRegex: "sales",
      requireStackKeywords: ["typescript", "python"],
    });
    expect(out).toHaveLength(2);
  });

  it("invalid regex degrades gracefully (does not throw)", () => {
    const out = applyIngestFilter(sample, { titleIncludeRegex: "([" });
    // Invalid regex → treated as null → no include filter applied.
    expect(out).toHaveLength(sample.length);
  });
});
