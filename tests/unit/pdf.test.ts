import { describe, expect, it } from "vitest";
import { renderCvBuffer } from "@/lib/pdf/render";
import { blankCvData, defaultTheme } from "@/lib/cv/defaults";

describe("PDF render", () => {
  it("produces a valid PDF buffer for the blank CV", async () => {
    const buf = await renderCvBuffer(blankCvData, defaultTheme);
    expect(buf.byteLength).toBeGreaterThan(500);
    // PDF magic header: "%PDF-"
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renders the ATS template when theme.template is 'ats'", async () => {
    const buf = await renderCvBuffer(
      { ...blankCvData, summary: "ATS-friendly summary." },
      { ...defaultTheme, template: "ats" },
    );
    expect(buf.byteLength).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("produces a larger PDF when given content", async () => {
    const buf = await renderCvBuffer(
      {
        ...blankCvData,
        summary: "A staff engineer with deep experience shipping production systems.",
        experiences: [
          {
            company: "Acme",
            role: "Staff Engineer",
            startDate: "2022-01",
            endDate: null,
            location: "Remote",
            summary: undefined,
            bullets: ["Led migration", "Mentored 4 engineers"],
            stack: ["TypeScript", "Postgres"],
          },
        ],
      },
      defaultTheme,
    );
    const blank = await renderCvBuffer(blankCvData, defaultTheme);
    expect(buf.byteLength).toBeGreaterThan(blank.byteLength);
  });
});
