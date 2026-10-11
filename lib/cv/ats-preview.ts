/**
 * Simulation textuelle de ce qu'un ATS extrait du CV.
 *
 * Le rendu est délibérément monospace, sans formatage, dans l'ordre canonique
 * de la langue du CV. Sert de "définition de vérité" : si une info n'apparaît pas ici, l'ATS
 * ne la verra pas non plus.
 */

import type { CvData } from "./schema";
import { formatAtsDate, formatLinkText } from "./format";

export function renderAtsPreview(data: CvData, locale: "fr" | "en" = "en"): string {
  const lines: string[] = [];
  const headings =
    locale === "fr"
      ? {
          summary: "PROFIL",
          skills: "COMPÉTENCES",
          experience: "EXPÉRIENCE PROFESSIONNELLE",
          projects: "PROJETS",
          education: "FORMATION",
          certifications: "CERTIFICATIONS",
          languages: "LANGUES",
          interests: "CENTRES D’INTÉRÊT",
        }
      : {
          summary: "SUMMARY",
          skills: "SKILLS",
          experience: "WORK EXPERIENCE",
          projects: "PROJECTS",
          education: "EDUCATION",
          certifications: "CERTIFICATIONS",
          languages: "LANGUAGES",
          interests: "INTERESTS",
        };

  // Contact
  lines.push(data.header.name);
  lines.push(data.header.title);
  const contact = [data.header.email, data.header.phone, data.header.location]
    .filter((b): b is string => Boolean(b))
    .join(" · ");
  if (contact) lines.push(contact);
  for (const l of data.header.links) lines.push(formatLinkText(l.href));
  lines.push("");

  if (data.summary) {
    lines.push(headings.summary);
    lines.push(data.summary);
    lines.push("");
  }

  if (data.skills.length) {
    lines.push(headings.skills);
    for (const g of data.skills) lines.push(`${g.category}: ${g.items.join(", ")}`);
    lines.push("");
  }

  if (data.experiences.length) {
    lines.push(headings.experience);
    for (const e of data.experiences) {
      lines.push(`${e.role} — ${e.company}`);
      lines.push(
        `${formatAtsDate(e.startDate, e.endDate, locale)}${e.location ? `  ·  ${e.location}` : ""}`,
      );
      if (e.summary) lines.push(e.summary);
      for (const b of e.bullets) lines.push(`- ${b}`);
      if (e.stack.length) lines.push(`Tech stack: ${e.stack.join(", ")}`);
      lines.push("");
    }
  }

  if (data.projects.length) {
    lines.push(headings.projects);
    for (const p of data.projects) {
      lines.push(p.name);
      if (p.url) lines.push(formatLinkText(p.url));
      lines.push(p.description);
      if (p.stack.length) lines.push(`Tech stack: ${p.stack.join(", ")}`);
      lines.push("");
    }
  }

  if (data.education.length) {
    lines.push(headings.education);
    for (const e of data.education) {
      lines.push(`${e.degree} — ${e.school}`);
      const period = formatAtsDate(e.startDate ?? null, e.endDate ?? null, locale);
      const loc = e.location ? `  ·  ${e.location}` : "";
      if (period || loc) lines.push(`${period}${loc}`);
      if (e.details) lines.push(e.details);
      lines.push("");
    }
  }

  if (data.certifications.length) {
    lines.push(headings.certifications);
    for (const c of data.certifications) {
      const date = c.date ? ` (${formatAtsDate(c.date, c.date, locale).split(" – ")[0]})` : "";
      lines.push(`${c.name} — ${c.issuer}${date}`);
      if (c.url) lines.push(formatLinkText(c.url));
    }
    lines.push("");
  }

  if (data.languages.length) {
    lines.push(headings.languages);
    lines.push(data.languages.map((l) => `${l.name} (${l.level})`).join(" · "));
    lines.push("");
  }

  if (data.interests.length) {
    lines.push(headings.interests);
    lines.push(data.interests.join(" · "));
  }

  return lines.join("\n");
}
