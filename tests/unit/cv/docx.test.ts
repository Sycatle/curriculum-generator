import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { renderCvDocxBuffer } from "@/lib/cv/docx";
import { sampleCvData } from "@/lib/cv/sample";

async function documentXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return zip.file("word/document.xml")!.async("string");
}

describe("renderCvDocxBuffer", () => {
  it("produces a non-empty docx buffer", async () => {
    const buf = await renderCvDocxBuffer(sampleCvData, "en");
    expect(buf.byteLength).toBeGreaterThan(2000);
    // DOCX = ZIP archive, starts with PK
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("localises section headings like the PDF (fr)", async () => {
    const xml = await documentXml(await renderCvDocxBuffer(sampleCvData, "fr"));
    for (const t of ["PROFIL", "COMPÉTENCES", "EXPÉRIENCE PROFESSIONNELLE", "FORMATION", "LANGUES"]) {
      expect(xml).toContain(t);
    }
    expect(xml).not.toContain("WORK EXPERIENCE");
    expect(xml).toContain("aujourd&apos;hui");
  });

  it("keeps English headings for en", async () => {
    const xml = await documentXml(await renderCvDocxBuffer(sampleCvData, "en"));
    expect(xml).toContain("WORK EXPERIENCE");
    expect(xml).toContain("Present");
  });
});
