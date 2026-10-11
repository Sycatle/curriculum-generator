import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import type { CvData, Theme } from "@/lib/cv/schema";
import { blankCvData, defaultTheme } from "@/lib/cv/defaults";
import { renderCvFitted } from "@/lib/pdf/fit";
import { renderCvBuffer } from "@/lib/pdf/render";

async function pdfText(buf: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  // Normalise wrapping / nbsp so assertions don't depend on line breaks.
  return { text: text.replace(/\s+/g, " "), pages: totalPages };
}

const frCv: CvData = {
  ...blankCvData,
  header: {
    name: "Éloïse Lefèvre-Çelik",
    title: "Développeuse full-stack",
    email: "eloise.lefevre@example.com",
    phone: "+33 6 12 34 56 78",
    location: "Saint-Étienne",
    links: [],
  },
  summary: "Ingénieure à l’écoute des équipes – passionnée par la qualité, l’œuvre collective et les façades.",
  experiences: [
    {
      company: "Société Générale Œuvres",
      role: "Développeuse sénior",
      startDate: "2020-01",
      endDate: null,
      location: "Paris",
      summary: undefined,
      bullets: ["Conçu l’architecture d’un service de paiement – déploiement à l’échelle."],
      stack: ["TypeScript"],
    },
    {
      company: "Crédit Agricole Ça Bouge",
      role: "Développeuse",
      startDate: "2017-03",
      endDate: "2019-12",
      location: undefined,
      summary: undefined,
      bullets: ["Migré les données vers une base relationnelle à haute disponibilité."],
      stack: [],
    },
  ],
  education: [
    {
      school: "École Centrale de Lyon",
      degree: "Ingénieure généraliste",
      startDate: "2012-09",
      endDate: "2017-06",
      location: undefined,
      details: undefined,
    },
  ],
  skills: [{ category: "Développement", items: ["TypeScript", "Postgres"] }],
  languages: [{ name: "Français", level: "Natif" }],
};

const SECTION_TITLES: Record<Theme["template"], string[]> = {
  ats: ["Profil", "Compétences", "Expérience professionnelle", "Formation", "Langues"],
  premium: ["Profil", "Compétences", "Expérience professionnelle", "Formation", "Langues"],
  modern: ["Profil", "Compétences", "Expérience", "Formation", "Langues"],
};

describe.each(["ats", "premium", "modern"] as const)("PDF text extraction — %s (fr)", (template) => {
  it("keeps titles, identity, companies and accents intact", async () => {
    const theme: Theme = { ...defaultTheme, template };
    const buf = await renderCvBuffer(frCv, theme, { locale: "fr" });
    const { text } = await pdfText(buf);
    // Headings are uppercased by the templates and must come out contiguous
    // ("PROFIL", not "P R O F I L"): whitespace is NOT stripped before comparing.
    for (const title of SECTION_TITLES[template]) expect(text).toContain(title.toUpperCase());
    expect(text).toContain("Éloïse");
    expect(text).toContain("eloise.lefevre@example.com");
    for (const e of frCv.experiences) expect(text).toContain(e.company);
    expect(text).toContain("École Centrale de Lyon");

    // Accents and typographic characters survive the PDF round-trip.
    for (const s of ["é", "è", "à", "ç", "œ", "’", "–"]) expect(text).toContain(s);
    expect(text).toContain("à l’écoute");
    expect(text).toContain("Lefèvre");
    expect(text).not.toContain("\uFFFD");
  }, 30000);
});

describe("stack items survive extraction", () => {
  const cv: CvData = {
    ...frCv,
    header: { ...frCv.header, title: "Software Engineer · Full-stack" },
    skills: [{ category: "Dev", items: ["TypeScript", "Node.js"] }],
    experiences: [{ ...frCv.experiences[0]!, stack: ["TypeScript", "Node.js", "Next.js"] }],
  };

  // Regression: fontkit memoised glyph codePoints across documents, so rendering
  // premium (title with "·") first corrupted ToUnicode in later PDFs ("Node.js" → "Node js").
  it("keeps TypeScript and Node.js intact in every template, whatever was rendered before", async () => {
    for (const template of ["premium", "ats", "modern", "premium", "modern"] as const) {
      const buf = await renderCvBuffer(cv, { ...defaultTheme, template }, { locale: "fr" });
      const { text } = await pdfText(buf);
      expect(text.toLowerCase(), template).toContain("typescript");
      expect(text.toLowerCase(), template).toContain("node.js");
      expect(text.toLowerCase(), template).toContain("next.js");
      expect(text, template).not.toMatch(/typ\dscript/i);
    }
  }, 60000);
});

function longCv(): CvData {
  return {
    ...frCv,
    experiences: Array.from({ length: 12 }, (_, i) => ({
      company: `Entreprise ${i}`,
      role: "Ingénieur sénior",
      startDate: "2015-01",
      endDate: "2016-12",
      location: "Paris",
      summary: "Mission transverse sur plusieurs produits à forte audience.",
      bullets: Array.from(
        { length: 8 },
        (_, k) => `Résultat mesurable numéro ${k + 1} avec un impact chiffré et une responsabilité claire.`,
      ),
      stack: ["TypeScript", "React", "Node.js"],
    })),
  };
}

describe("fit report", () => {
  it("reports cut content when a single-page CV is too long", async () => {
    const r = await renderCvFitted(longCv(), { ...defaultTheme, template: "ats" }, "fr");
    expect(r.report.pass).toBeGreaterThan(0);
    expect(r.report.droppedBullets + r.report.droppedExperiences).toBeGreaterThan(0);
    expect(r.report.pages === 1 || r.report.overflowed).toBe(true);
    const { pages } = await pdfText(r.buffer);
    expect(pages).toBe(1);
  }, 120000);

  it("reduces font/spacing before cutting for the ATS template", async () => {
    // A moderately long CV should fit by shrinking only.
    const cv: CvData = { ...frCv, experiences: longCv().experiences.slice(0, 3) };
    const r = await renderCvFitted(cv, { ...defaultTheme, template: "ats" }, "fr");
    expect(r.report.droppedBullets).toBe(0);
    expect(r.report.droppedExperiences).toBe(0);
    expect(r.report.overflowed).toBe(false);
  }, 60000);

  it("reports no cut for a short CV", async () => {
    const r = await renderCvFitted(frCv, { ...defaultTheme, template: "ats" }, "fr");
    expect(r.report).toMatchObject({
      pass: 0,
      fontScale: 1,
      droppedBullets: 0,
      droppedExperiences: 0,
      overflowed: false,
      pages: 1,
    });
  }, 30000);
});
