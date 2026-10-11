import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { CvPremiumDocument } from "@/lib/pdf/template-premium";
import { sampleCvData } from "@/lib/cv/sample";
import { defaultTheme } from "@/lib/cv/defaults";

describe("CvPremiumDocument", () => {
  it("renders a non-empty PDF buffer", async () => {
    const doc = <CvPremiumDocument data={sampleCvData} theme={defaultTheme} />;
    const buf = await renderToBuffer(doc);
    expect(buf.byteLength).toBeGreaterThan(3000);
    expect(buf[0]).toBe(0x25); // %
    expect(buf[1]).toBe(0x50); // P
    expect(buf[2]).toBe(0x44); // D
    expect(buf[3]).toBe(0x46); // F
  });
});
