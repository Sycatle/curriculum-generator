import { describe, expect, it } from "vitest";
import { renderCvDocxBuffer } from "@/lib/cv/docx";
import { sampleCvData } from "@/lib/cv/sample";

describe("renderCvDocxBuffer", () => {
  it("produces a non-empty docx buffer", async () => {
    const buf = await renderCvDocxBuffer(sampleCvData, "en");
    expect(buf.byteLength).toBeGreaterThan(2000);
    // DOCX = ZIP archive, starts with PK
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
