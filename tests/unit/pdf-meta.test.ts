import { describe, expect, it } from "vitest";
import { getDocumentProxy } from "unpdf";
import type { CvData } from "@/lib/cv/schema";
import { blankCvData, defaultTheme } from "@/lib/cv/defaults";
import { renderCvBuffer } from "@/lib/pdf/render";

const cv: CvData = {
  ...blankCvData,
  header: {
    name: "Éloïse Lefèvre",
    title: "Développeuse full-stack",
    email: "eloise@example.com",
    phone: "06 12 34 56 78",
    location: "Lyon",
    links: [{ label: "GitHub", href: "https://github.com/eloise" }],
  },
  skills: [
    { category: "Dev", items: ["TypeScript", "React"] },
    { category: "Autre", items: ["typescript", "Postgres", " "] },
  ],
};

async function open(template: "ats" | "premium" | "modern", locale: "fr" | "en") {
  const buf = await renderCvBuffer(cv, { ...defaultTheme, template }, { locale });
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { info } = (await pdf.getMetadata()) as unknown as { info: Record<string, string> };
  const annotations = await (await pdf.getPage(1)).getAnnotations();
  return { raw: Buffer.from(buf).toString("latin1"), info, urls: annotations.map((a: { url?: string }) => a.url) };
}

describe.each(["ats", "premium", "modern"] as const)("PDF metadata and links — %s", (template) => {
  it("sets /Lang, Subject and de-duplicated Keywords", async () => {
    const fr = await open(template, "fr");
    expect(fr.raw).toMatch(/\/Lang\s*\(fr-FR\)/);
    expect(fr.info.Language).toBe("fr-FR");
    expect(fr.info.Subject).toBe("Développeuse full-stack");
    expect(fr.info.Keywords).toBe("TypeScript, React, Postgres");
    expect(fr.info.Title).toBe("Éloïse Lefèvre — Développeuse full-stack");
    expect(fr.info.Author).toBe("Éloïse Lefèvre");

    const en = await open(template, "en");
    expect(en.raw).toMatch(/\/Lang\s*\(en-US\)/);
  }, 30000);

  it("makes email and phone clickable with a normalised tel: number", async () => {
    const { urls } = await open(template, "fr");
    expect(urls).toContain("mailto:eloise@example.com");
    expect(urls).toContain("tel:+33612345678");
    expect(urls).toContain("https://github.com/eloise");
  }, 30000);
});
