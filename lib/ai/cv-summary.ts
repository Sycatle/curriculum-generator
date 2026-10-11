/**
 * Compact CV summary for LLM matching prompts.
 *
 * Deterministic serialization (~400-600 tokens). Reused as a cache-friendly
 * prefix in `lib/jobs/llm-match.ts`. We strip URLs, dates and noise; we keep
 * roles, stacks, last 5 experiences, languages, and the top skills.
 */

import type { CvData } from "@/lib/cv/schema";

const MAX_EXPERIENCES = 5;
const MAX_SKILLS = 30;
const MAX_PROJECTS = 3;

function shortDate(d: string | null | undefined): string {
  if (!d) return "";
  // d is MonthYear: "YYYY-MM"; show only the year for brevity
  return d.slice(0, 4);
}

export function summarizeCvForMatch(cv: CvData): string {
  const lines: string[] = [];

  lines.push(`Name: ${cv.header.name}`);
  lines.push(`Title: ${cv.header.title}`);
  if (cv.header.location) lines.push(`Location: ${cv.header.location}`);
  if (cv.summary) lines.push(`Summary: ${cv.summary}`);

  if (cv.skills.length > 0) {
    const flat = cv.skills.flatMap((g) => g.items).slice(0, MAX_SKILLS);
    lines.push(`Skills: ${flat.join(", ")}`);
  }

  if (cv.languages.length > 0) {
    lines.push(
      `Languages: ${cv.languages.map((l) => `${l.name} (${l.level})`).join(", ")}`,
    );
  }

  if (cv.experiences.length > 0) {
    lines.push("Experiences:");
    for (const xp of cv.experiences.slice(0, MAX_EXPERIENCES)) {
      const range = `${shortDate(xp.startDate)}–${xp.endDate ? shortDate(xp.endDate) : "now"}`;
      const stack = xp.stack.slice(0, 8).join(", ");
      lines.push(`  - ${xp.role} @ ${xp.company} (${range})${stack ? ` — ${stack}` : ""}`);
      if (xp.summary) lines.push(`    ${xp.summary}`);
    }
  }

  if (cv.projects.length > 0) {
    lines.push("Projects:");
    for (const p of cv.projects.slice(0, MAX_PROJECTS)) {
      const stack = p.stack.slice(0, 6).join(", ");
      lines.push(`  - ${p.name}: ${p.description}${stack ? ` (${stack})` : ""}`);
    }
  }

  return lines.join("\n");
}
