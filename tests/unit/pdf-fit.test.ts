import { describe, expect, it } from "vitest";
import type { CvData, Theme } from "@/lib/cv/schema";
import { blankCvData, defaultTheme } from "@/lib/cv/defaults";
import { renderCvFitted } from "@/lib/pdf/fit";
import { countPagesInPdfBuffer, countPdfPages } from "@/lib/pdf/measure";
import { renderCvBuffer } from "@/lib/pdf/render";

function makeExperience(i: number, bulletCount: number) {
  return {
    company: `Acme Corp ${i}`,
    role: "Senior Engineer",
    startDate: "2018-01",
    endDate: "2020-12" as string | null,
    location: "Paris" as string | undefined,
    summary: "Built things and shipped them." as string | undefined,
    bullets: Array.from({ length: bulletCount }, (_, k) =>
      `Achieved measurable result number ${k + 1} with quantified impact and clear ownership.`,
    ),
    stack: ["TypeScript", "React", "Node.js"],
  };
}

function bloatedCv(): CvData {
  return {
    ...blankCvData,
    header: {
      ...blankCvData.header,
      name: "Jane Doe",
      title: "Principal Engineer",
      email: "jane@example.com",
    },
    summary:
      "Veteran engineer with two decades shipping production systems across fintech, healthcare, and developer tools. Loves API design, distributed systems, and mentoring.",
    experiences: Array.from({ length: 12 }, (_, i) => makeExperience(i, 8)),
    skills: [
      { category: "Languages", items: ["TypeScript", "Python", "Go", "Rust", "Java"] },
      { category: "Cloud", items: ["AWS", "GCP", "Azure", "Cloudflare"] },
      { category: "Tools", items: ["Docker", "Kubernetes", "Terraform", "Prometheus"] },
    ],
    languages: [
      { name: "French", level: "Native" },
      { name: "English", level: "C2" },
      { name: "Spanish", level: "B2" },
    ],
  };
}

const theme: Theme = defaultTheme;

describe("countPagesInPdfBuffer", () => {
  it("returns 0 on an empty buffer", () => {
    expect(countPagesInPdfBuffer(Buffer.alloc(0))).toBe(0);
  });

  it("doesn't count `/Pages` as a page", () => {
    const fake = Buffer.from("<< /Type /Pages /Count 1 /Kids [ << /Type /Page >> ] >>");
    expect(countPagesInPdfBuffer(fake)).toBe(1);
  });
});

describe("countPdfPages (real render)", () => {
  it("returns 1 for a blank CV", async () => {
    const pages = await countPdfPages(blankCvData, theme);
    expect(pages).toBe(1);
  }, 15000);

  it("returns >1 for a bloated CV when no overrides are applied", async () => {
    const pages = await countPdfPages(bloatedCv(), theme);
    expect(pages).toBeGreaterThan(1);
  }, 30000);
});

describe("renderCvFitted", () => {
  it("blank CV passes on first attempt (no compression)", async () => {
    const r = await renderCvFitted(blankCvData, theme);
    expect(r.overflowed).toBe(false);
    expect(r.pass).toBe(0);
    expect(countPagesInPdfBuffer(r.buffer)).toBe(1);
  }, 15000);

  it("bloated CV is forced into 1 page (any pass)", async () => {
    const r = await renderCvFitted(bloatedCv(), theme);
    expect(countPagesInPdfBuffer(r.buffer)).toBeLessThanOrEqual(1);
    // Should require a non-zero pass to fit
    expect(r.pass).toBeGreaterThan(0);
  }, 60000);
});

describe("multi-page PDF export", () => {
  it("keeps natural pagination when selected", async () => {
    const buf = await renderCvBuffer(bloatedCv(), { ...theme, pageMode: "multi" });
    expect(countPagesInPdfBuffer(buf)).toBeGreaterThan(1);
  }, 30000);
});
