/**
 * Export DOCX d'un CV. Le DOCX est le format préféré des ATS en 2026
 * (parsing plus fiable que PDF). Source de vérité unique : `CvData`.
 *
 * Règles ATS appliquées :
 * - Single column (paragraphes simples, aucune table/textbox/colonne).
 * - Headings standards EN ("Work Experience", "Education", …).
 * - Dates MM/YYYY via `formatAtsDate`.
 * - Ordre canonique Contact → Summary → Skills → Experience → Projects →
 *   Education → Certifications → Languages → Interests.
 * - Police : Calibri 11 (safe-list ATS).
 */

import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from "docx";
import type { CvData } from "./schema";
import { formatAtsDate, formatLinkText } from "./format";

const FONT = "Calibri";

function h1(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text, bold: true, size: 36, font: FONT }), // 18pt
    ],
  });
}

function subtitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: FONT, color: "333333" })],
  });
}

function contactLine(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 20, font: FONT })],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: "single", size: 6, color: "000000", space: 1 } },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 20,
        font: FONT,
        characterSpacing: 24,
      }),
    ],
  });
}

function body(text: string, bold = false): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 22, font: FONT, bold })],
  });
}

function meta(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 20, font: FONT, color: "333333" })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 22, font: FONT })],
  });
}

function linkPara(href: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new ExternalHyperlink({
        link: href,
        children: [
          new TextRun({
            text: formatLinkText(href),
            style: "Hyperlink",
            underline: { type: UnderlineType.SINGLE, color: "111111" },
            size: 20,
            font: FONT,
            color: "111111",
          }),
        ],
      }),
    ],
  });
}

function itemTitleLine(role: string, company: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 20 },
    children: [
      new TextRun({ text: `${role} — ${company}`, bold: true, size: 22, font: FONT }),
    ],
  });
}

export async function renderCvDocxBuffer(data: CvData, locale: "fr" | "en" = "en"): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];

  // ----- Contact bloc
  paragraphs.push(h1(data.header.name));
  paragraphs.push(subtitle(data.header.title));

  const contactBits = [data.header.email, data.header.phone, data.header.location].filter(
    (b): b is string => Boolean(b),
  );
  if (contactBits.length) paragraphs.push(contactLine(contactBits.join(" · ")));
  for (const l of data.header.links) paragraphs.push(linkPara(l.href));

  // ----- Summary
  if (data.summary) {
    paragraphs.push(sectionHeading("Summary"));
    paragraphs.push(body(data.summary));
  }

  // ----- Skills
  if (data.skills.length) {
    paragraphs.push(sectionHeading("Skills"));
    for (const g of data.skills) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${g.category}: `, bold: true, size: 22, font: FONT }),
            new TextRun({ text: g.items.join(", "), size: 22, font: FONT }),
          ],
        }),
      );
    }
  }

  // ----- Work Experience
  if (data.experiences.length) {
    paragraphs.push(sectionHeading("Work Experience"));
    for (const e of data.experiences) {
      paragraphs.push(itemTitleLine(e.role, e.company));
      const period = formatAtsDate(e.startDate, e.endDate, locale);
      const loc = e.location ? ` · ${e.location}` : "";
      paragraphs.push(meta(`${period}${loc}`));
      if (e.summary) paragraphs.push(body(e.summary));
      for (const b of e.bullets) paragraphs.push(bullet(b));
      if (e.stack.length) paragraphs.push(meta(`Tech stack: ${e.stack.join(", ")}`));
    }
  }

  // ----- Projects
  if (data.projects.length) {
    paragraphs.push(sectionHeading("Projects"));
    for (const p of data.projects) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 20 },
          children: [new TextRun({ text: p.name, bold: true, size: 22, font: FONT })],
        }),
      );
      if (p.url) paragraphs.push(linkPara(p.url));
      paragraphs.push(body(p.description));
      if (p.stack.length) paragraphs.push(meta(`Tech stack: ${p.stack.join(", ")}`));
    }
  }

  // ----- Education
  if (data.education.length) {
    paragraphs.push(sectionHeading("Education"));
    for (const e of data.education) {
      paragraphs.push(itemTitleLine(e.degree, e.school));
      const period = formatAtsDate(e.startDate ?? null, e.endDate ?? null, locale);
      const loc = e.location ? ` · ${e.location}` : "";
      if (period || loc) paragraphs.push(meta(`${period}${loc}`));
      if (e.details) paragraphs.push(body(e.details));
    }
  }

  // ----- Certifications
  if (data.certifications.length) {
    paragraphs.push(sectionHeading("Certifications"));
    for (const c of data.certifications) {
      const dateText = c.date ? ` (${formatAtsDate(c.date, c.date, locale).split(" – ")[0]})` : "";
      paragraphs.push(body(`${c.name} — ${c.issuer}${dateText}`));
      if (c.url) paragraphs.push(linkPara(c.url));
    }
  }

  // ----- Languages
  if (data.languages.length) {
    paragraphs.push(sectionHeading("Languages"));
    paragraphs.push(body(data.languages.map((l) => `${l.name} (${l.level})`).join(" · ")));
  }

  // ----- Interests
  if (data.interests.length) {
    paragraphs.push(sectionHeading("Interests"));
    paragraphs.push(body(data.interests.join(" · ")));
  }

  const doc = new Document({
    creator: "CV Generator",
    title: `${data.header.name} — ${data.header.title}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 1000, right: 1000 } },
        },
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc) as unknown as Promise<Buffer>;
}
