import { describe, expect, it } from "vitest";
import { renderAtsPreview } from "@/lib/cv/ats-preview";
import { sampleCvData } from "@/lib/cv/sample";

describe("renderAtsPreview", () => {
  it("emits canonical EN headings", () => {
    const txt = renderAtsPreview(sampleCvData);
    expect(txt).toMatch(/^.+\n.+\n/); // name + title at top
    expect(txt).toMatch(/SUMMARY/);
    expect(txt).toMatch(/WORK EXPERIENCE/);
    expect(txt).toMatch(/SKILLS/);
    expect(txt).toMatch(/EDUCATION/);
  });

  it("uses standard FR headings for French CVs", () => {
    const txt = renderAtsPreview(sampleCvData, "fr");
    expect(txt).toMatch(/PROFIL/);
    expect(txt).toMatch(/EXPÉRIENCE PROFESSIONNELLE/);
    expect(txt).toMatch(/COMPÉTENCES/);
    expect(txt).toMatch(/FORMATION/);
  });

  it("formats dates as MM/YYYY", () => {
    const txt = renderAtsPreview(sampleCvData);
    expect(txt).toMatch(/\b\d{2}\/\d{4}\b/);
  });
});
