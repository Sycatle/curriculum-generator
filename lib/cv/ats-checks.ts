/**
 * Checks ATS déterministes, sans appel IA, instantanés.
 *
 * Référence : `docs/research/cv-watch-2026.md`. Modifier les seuils ici, pas
 * dans les composants UI. Chaque check produit au plus une `Issue` ; le
 * score est `100 - somme(impact)` clampé à [0, 100].
 */

import type { CvData } from "./schema";
import { LIMITS } from "./limits";

export type Severity = "error" | "warning" | "info";

export type IssueCode =
  | "missing.email"
  | "missing.summary"
  | "missing.experience"
  | "missing.skills"
  | "missing.education"
  | "missing.public-link"
  | "summary.too-short"
  | "summary.too-long"
  | "photo.present"
  | "languages.too-many"
  | "skills.too-many"
  | "skills.too-few-groups"
  | "skills.generic"
  | "dates.bad-format"
  | "header.no-title"
  | "header.no-location"
  | "dates.end-before-start"
  | "dates.gap"
  | "dates.overlap"
  | "skills.unproven"
  | "experiences.no-stack"
  | "bullets.no-verb"
  | "bullets.no-metric"
  | "bullets.weak-verb"
  | "bullets.too-long"
  | "bullets.passive"
  | "experiences.empty-bullets"
  | "links.broken-protocol";

export type Issue = {
  code: IssueCode;
  severity: Severity;
  /** Phrase courte affichée à l'utilisateur (FR). */
  message: string;
  /** Path JSON pointant vers la zone à corriger (pour le scroll-to). */
  path?: string;
  /** Impact sur le score (0-100). */
  impact: number;
};

export type AtsScoreResult = {
  score: number;
  issues: Issue[];
  /** Détail par catégorie pour un affichage en jauges si besoin. */
  buckets: {
    structure: number;
    content: number;
    formatting: number;
  };
};

const STRONG_VERBS = new Set([
  "built", "designed", "shipped", "led", "owned", "architected", "migrated",
  "reduced", "increased", "improved", "scaled", "launched", "delivered",
  "implemented", "developed", "automated", "refactored", "optimized",
  "deployed", "created", "engineered", "drove", "founded", "rebuilt",
  "modernized", "redesigned", "introduced", "spearheaded",
  // FR equivalents
  "conçu", "construit", "livré", "lancé", "dirigé", "implémenté",
  "réduit", "augmenté", "amélioré", "migré", "automatisé", "déployé",
  "refondu", "optimisé", "développé",
]);

// Participe passé anglais (-ed) ou français (-é, -i, -is, -it, -u, -ert) : "Repris", "Écrit", "Couvert"…
const PAST_PARTICIPLE = /^.{3,}(ed|é|ée|és|ées|i|is|it|u|us|ert)$/i;

const WEAK_VERBS = new Set([
  "helped", "assisted", "participated", "worked", "responsible",
  "supported", "involved", "various", "duties",
  "aidé", "participé", "travaillé", "contribué", "responsable",
]);

const PASSIVE_PATTERNS = [/\bwas\s+\w+ed\b/i, /\bwere\s+\w+ed\b/i, /\bbeen\s+\w+ed\b/i];

const GENERIC_SKILLS = new Set([
  "microsoft word", "ms word", "word", "excel", "powerpoint", "html", "json",
  "internet", "email", "windows", "mac os", "office",
]);

const VALID_DATE = /^\d{4}(-\d{2})?$/;

function hasMetric(text: string): boolean {
  // chiffre + unité ou pourcentage ou multiplicateur ou nombre brut > 1
  if (/\d{2,}|\d+%|\d+x|\d+\s*(ms|s|min|h|k|M|MAU|DAU|req|qps|rps|users|customers|€|\$)/i.test(text))
    return true;
  // chiffres écrits "from X to Y" ou approximations
  if (/~\s*\d+|\d+\s*(million|billion|thousand)/i.test(text)) return true;
  return false;
}

function firstWord(text: string): string {
  const m = text.trim().match(/^[\p{L}'’-]+/u);
  return m ? m[0].toLowerCase() : "";
}

const MAX_GAP_MONTHS = 6;

/** Index de mois absolu (année*12 + mois-0). Année seule : janvier (début) ou décembre (fin). */
function parseMonth(date: string, edge: "start" | "end"): number | null {
  if (!VALID_DATE.test(date)) return null;
  const year = Number(date.slice(0, 4));
  if (date.length === 4) return year * 12 + (edge === "start" ? 0 : 11);
  const month = Number(date.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return year * 12 + month - 1;
}

function monthLabel(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

type Period = { company: string; start: number; end: number };

/** Périodes valides (bornes incluses), `endDate` null = mois de `now`, fin plafonnée à `now`. */
function experiencePeriods(data: CvData, now: Date): Period[] {
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  const periods: Period[] = [];
  for (const e of data.experiences) {
    const start = parseMonth(e.startDate, "start");
    const end = e.endDate === null ? nowIndex : parseMonth(e.endDate, "end");
    if (start === null || end === null) continue;
    const clamped = Math.min(end, nowIndex);
    if (clamped < start) continue;
    periods.push({ company: e.company, start, end: clamped });
  }
  return periods;
}

/** Union des périodes triées, les périodes contiguës ou qui se chevauchent sont fusionnées. */
function mergePeriods(periods: Period[]): Array<{ start: number; end: number }> {
  const merged: Array<{ start: number; end: number }> = [];
  for (const p of [...periods].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && p.start <= last.end + 1) last.end = Math.max(last.end, p.end);
    else merged.push({ start: p.start, end: p.end });
  }
  return merged;
}

/**
 * Mois d'expérience cumulés : union des périodes (un chevauchement n'est
 * compté qu'une fois), `endDate` null = `now`.
 */
export function totalExperienceMonths(data: CvData, now: Date = new Date()): number {
  return mergePeriods(experiencePeriods(data, now)).reduce(
    (acc, p) => acc + (p.end - p.start + 1),
    0,
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mot entier, insensible à la casse ; "Node.js" ≈ "Node" ≈ "nodejs" ≈ "node js". */
function skillRegex(item: string): RegExp {
  const lower = item.trim().toLowerCase();
  const stripped = lower.replace(/[\s.-]*js$/, "");
  const base = stripped.length > 0 ? stripped : lower;
  const body = base.split(/[\s.-]+/).filter(Boolean).map(escapeRegex).join("[\\s.-]*");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${body}(?:[\\s.-]*js)?(?![\\p{L}\\p{N}+#])`,
    "u",
  );
}

function unprovenSkills(data: CvData): string[] {
  if (data.experiences.length === 0 && data.projects.length === 0) return [];
  const corpus = [
    ...data.experiences.flatMap((e) => [e.summary ?? "", ...e.bullets, ...e.stack]),
    ...data.projects.flatMap((p) => [p.name, p.description, ...p.stack]),
    data.summary ?? "",
  ]
    .join("\n")
    .toLowerCase();
  const out: string[] = [];
  for (const item of data.skills.flatMap((g) => g.items)) {
    if (!skillRegex(item).test(corpus) && !out.includes(item)) out.push(item);
  }
  return out;
}

function listPreview(items: string[], max = 6): string {
  return items.slice(0, max).join(", ") + (items.length > max ? "…" : "");
}

export function computeAtsScore(data: CvData, now: Date = new Date()): AtsScoreResult {
  const issues: Issue[] = [];

  function push(i: Issue) {
    issues.push(i);
  }

  // ---- Structure (présence des sections essentielles)
  if (!data.header.email)
    push({
      code: "missing.email",
      severity: "error",
      impact: 8,
      message: "Email manquant — les ATS rejettent souvent un CV sans contact email.",
      path: "header.email",
    });

  if (!data.header.title?.trim())
    push({
      code: "header.no-title",
      severity: "warning",
      impact: 5,
      message: "Titre de poste absent de l'en-tête — le recruteur filtre sur le poste et la ville.",
      path: "header.title",
    });

  if (!data.header.location?.trim())
    push({
      code: "header.no-location",
      severity: "warning",
      impact: 3,
      message: "Localisation absente de l'en-tête — le recruteur filtre sur le poste et la ville.",
      path: "header.location",
    });

  if (!data.summary || data.summary.trim().length < 60)
    push({
      code: "missing.summary",
      severity: "warning",
      impact: 5,
      message: "Pas de résumé professionnel (2–3 phrases qui positionnent le candidat).",
      path: "summary",
    });
  else if (data.summary.length > LIMITS.summaryChars.hard)
    push({
      code: "summary.too-long",
      severity: "warning",
      impact: 3,
      message: `Résumé trop long (${data.summary.length} caractères, viser < ${LIMITS.summaryChars.soft}).`,
      path: "summary",
    });

  if (data.experiences.length === 0)
    push({
      code: "missing.experience",
      severity: "error",
      impact: 15,
      message: "Aucune expérience professionnelle — section indispensable.",
      path: "experiences",
    });

  if (data.skills.length === 0)
    push({
      code: "missing.skills",
      severity: "error",
      impact: 10,
      message: "Aucun bloc de compétences — les ATS extraient les mots-clés depuis cette section.",
      path: "skills",
    });
  else if (data.skills.length < 2)
    push({
      code: "skills.too-few-groups",
      severity: "info",
      impact: 2,
      message: "Catégorise tes compétences (Langages, Frameworks, Outils…) pour faciliter le scan.",
      path: "skills",
    });

  if (data.education.length === 0)
    push({
      code: "missing.education",
      severity: "warning",
      impact: 4,
      message: "Section formation absente.",
      path: "education",
    });

  // Lien public attendu pour rôles tech/front/full-stack
  const titleLc = data.header.title.toLowerCase();
  const isTechRole = /(engineer|developer|developpeur|développeur|frontend|fullstack|full-stack|backend|product|design)/i.test(
    titleLc,
  );
  const hasGithub = data.header.links.some((l) =>
    /github\.com|gitlab\.com|portfolio|behance|dribbble|linkedin\.com/i.test(l.href),
  );
  if (isTechRole && !hasGithub)
    push({
      code: "missing.public-link",
      severity: "warning",
      impact: 6,
      message: "Aucun lien public (GitHub / portfolio / LinkedIn) — red flag pour un rôle tech.",
      path: "header.links",
    });

  // ---- Formatting (règles ATS dures)
  if (data.photoUrl)
    push({
      code: "photo.present",
      severity: "warning",
      impact: 6,
      message: "Photo détectée — déconseillée (biais légal aux US/UK, peu pertinent en tech).",
      path: "photoUrl",
    });

  const totalSkills = data.skills.reduce((acc, g) => acc + g.items.length, 0);
  if (totalSkills > 30)
    push({
      code: "skills.too-many",
      severity: "warning",
      impact: 4,
      message: `${totalSkills} compétences listées — limite à 10–16 pour signaler la maîtrise.`,
      path: "skills",
    });

  const genericFound = data.skills.flatMap((g) =>
    g.items.filter((it) => GENERIC_SKILLS.has(it.trim().toLowerCase())),
  );
  if (genericFound.length > 0)
    push({
      code: "skills.generic",
      severity: "info",
      impact: 3,
      message: `Compétences génériques détectées (${genericFound.join(", ")}) — à retirer pour un SWE/PE.`,
      path: "skills",
    });

  if (data.languages.length > 6)
    push({
      code: "languages.too-many",
      severity: "info",
      impact: 2,
      message: `${data.languages.length} langues listées — un recruteur attend les 2-4 vraiment maîtrisées.`,
      path: "languages",
    });

  // Dates au format YYYY ou YYYY-MM (stockage interne). On vérifie qu'aucune date stockée n'est aberrante.
  const badDates: string[] = [];
  for (const e of data.experiences) {
    if (!VALID_DATE.test(e.startDate)) badDates.push(`exp.${e.company}.start`);
    if (e.endDate && !VALID_DATE.test(e.endDate)) badDates.push(`exp.${e.company}.end`);
  }
  for (const e of data.education) {
    if (e.startDate && !VALID_DATE.test(e.startDate)) badDates.push(`edu.${e.school}.start`);
    if (e.endDate && !VALID_DATE.test(e.endDate)) badDates.push(`edu.${e.school}.end`);
  }
  if (badDates.length > 0)
    push({
      code: "dates.bad-format",
      severity: "error",
      impact: 6,
      message: `Dates au mauvais format (attendu YYYY-MM) : ${badDates.slice(0, 3).join(", ")}${badDates.length > 3 ? "…" : ""}`,
    });

  // Cohérence des dates : fin avant début, trous, chevauchements.
  const reversed = data.experiences.filter((e) => {
    if (e.endDate === null) return false;
    const s = parseMonth(e.startDate, "start");
    const en = parseMonth(e.endDate, "end");
    return s !== null && en !== null && en < s;
  });
  if (reversed.length > 0)
    push({
      code: "dates.end-before-start",
      severity: "error",
      impact: 8,
      message: `Date de fin antérieure à la date de début : ${listPreview(reversed.map((e) => e.company), 3)}.`,
      path: "experiences",
    });

  const periods = experiencePeriods(data, now);
  const merged = mergePeriods(periods);
  const gaps: string[] = [];
  for (let i = 1; i < merged.length; i++) {
    const months = merged[i]!.start - merged[i - 1]!.end - 1;
    if (months > MAX_GAP_MONTHS)
      gaps.push(`${months} mois entre ${monthLabel(merged[i - 1]!.end)} et ${monthLabel(merged[i]!.start)}`);
  }
  if (gaps.length > 0)
    push({
      code: "dates.gap",
      severity: "warning",
      impact: 4,
      message: `Trou de plus de ${MAX_GAP_MONTHS} mois dans le parcours (${listPreview(gaps, 2)}) — explique-le (formation, freelance, projet perso).`,
      path: "experiences",
    });

  const overlaps: string[] = [];
  for (let i = 0; i < periods.length; i++)
    for (let j = i + 1; j < periods.length; j++) {
      const a = periods[i]!;
      const b = periods[j]!;
      if (a.start < b.end && b.start < a.end) overlaps.push(`${a.company} / ${b.company}`);
    }
  if (overlaps.length > 0)
    push({
      code: "dates.overlap",
      severity: "info",
      impact: 0,
      message: `Périodes qui se chevauchent (${listPreview(overlaps, 3)}) — légitime pour des missions freelance parallèles, à préciser.`,
      path: "experiences",
    });

  // Liens : protocole valide ?
  const brokenLinks = data.header.links.filter((l) => !/^https?:\/\//i.test(l.href));
  if (brokenLinks.length > 0)
    push({
      code: "links.broken-protocol",
      severity: "warning",
      impact: 3,
      message: `Lien(s) sans protocole http(s):// : ${brokenLinks.map((l) => l.label).join(", ")}`,
      path: "header.links",
    });

  // ---- Content (qualité des bullets)
  const unproven = unprovenSkills(data);
  if (unproven.length > 0)
    push({
      code: "skills.unproven",
      severity: "warning",
      impact: Math.min(6, unproven.length),
      message: `Compétence affirmée mais non prouvée par une expérience : ${listPreview(unproven, 8)}.`,
      path: "skills",
    });

  const noStack = data.experiences.filter((e) => e.stack.length === 0);
  if (noStack.length > 0)
    push({
      code: "experiences.no-stack",
      severity: "warning",
      impact: Math.min(6, noStack.length * 2),
      message: `Stack technique absente pour ${listPreview(noStack.map((e) => e.company), 3)} — le lead dev cherche les technos par poste.`,
      path: "experiences",
    });

  let totalBullets = 0;
  let noMetric = 0;
  let weakVerb = 0;
  let noVerb = 0;
  let tooLong = 0;
  let passive = 0;
  for (const exp of data.experiences) {
    if (exp.bullets.length === 0)
      push({
        code: "experiences.empty-bullets",
        severity: "warning",
        impact: 4,
        message: `Aucun bullet pour ${exp.company} — décris l'impact en 3–5 puces.`,
        path: `experiences.${exp.company}`,
      });
    for (const b of exp.bullets) {
      totalBullets++;
      const w = firstWord(b);
      if (!w) noVerb++;
      else if (WEAK_VERBS.has(w)) weakVerb++;
      else if (!STRONG_VERBS.has(w) && !PAST_PARTICIPLE.test(w)) noVerb++;
      if (!hasMetric(b)) noMetric++;
      if (b.length > LIMITS.bulletChars.hard) tooLong++;
      if (PASSIVE_PATTERNS.some((rx) => rx.test(b))) passive++;
    }
  }

  if (totalBullets > 0) {
    const ratioNoMetric = noMetric / totalBullets;
    if (ratioNoMetric > 0.5)
      push({
        code: "bullets.no-metric",
        severity: "warning",
        impact: 10,
        message: `${noMetric}/${totalBullets} bullets sans chiffre. Vise au moins 1 métrique par puce.`,
      });
    if (weakVerb > 0)
      push({
        code: "bullets.weak-verb",
        severity: "warning",
        impact: Math.min(8, weakVerb * 2),
        message: `${weakVerb} bullet(s) commencent par un verbe faible (helped, responsible…). Préfère Built/Shipped/Reduced.`,
      });
    if (noVerb > 0)
      push({
        code: "bullets.no-verb",
        severity: "info",
        impact: Math.min(4, noVerb),
        message: `${noVerb} bullet(s) ne commencent pas par un verbe d'action fort au passé.`,
      });
    if (tooLong > 0)
      push({
        code: "bullets.too-long",
        severity: "info",
        impact: Math.min(4, tooLong),
        message: `${tooLong} bullet(s) > ${LIMITS.bulletChars.hard} caractères — coupe pour rester scannable.`,
      });
    if (passive > 0)
      push({
        code: "bullets.passive",
        severity: "info",
        impact: Math.min(4, passive),
        message: `${passive} bullet(s) à la voix passive — préfère "Built X" à "X was built".`,
      });
  }

  // ---- Buckets pour affichage en jauges
  const sum = (codes: IssueCode[]) =>
    issues.filter((i) => codes.includes(i.code)).reduce((a, b) => a + b.impact, 0);
  const structureImpact = sum([
    "missing.email",
    "missing.summary",
    "missing.experience",
    "missing.skills",
    "missing.education",
    "missing.public-link",
    "header.no-title",
    "header.no-location",
  ]);
  const contentImpact = sum([
    "bullets.no-verb",
    "bullets.no-metric",
    "bullets.weak-verb",
    "bullets.too-long",
    "bullets.passive",
    "experiences.empty-bullets",
    "skills.unproven",
    "experiences.no-stack",
  ]);
  const formattingImpact = sum([
    "photo.present",
    "languages.too-many",
    "skills.too-many",
    "skills.too-few-groups",
    "skills.generic",
    "dates.bad-format",
    "dates.end-before-start",
    "dates.gap",
    "dates.overlap",
    "links.broken-protocol",
    "summary.too-long",
    "summary.too-short",
  ]);

  const total = issues.reduce((a, b) => a + b.impact, 0);
  const score = Math.max(0, Math.min(100, 100 - total));

  return {
    score,
    issues: [...issues].sort(severityOrder),
    buckets: {
      structure: Math.max(0, 100 - structureImpact * 2),
      content: Math.max(0, 100 - contentImpact * 2),
      formatting: Math.max(0, 100 - formattingImpact * 2),
    },
  };
}

function severityOrder(a: Issue, b: Issue): number {
  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return rank[a.severity] - rank[b.severity] || b.impact - a.impact;
}

/** Bande de qualité pour pastille colorée. */
export function scoreBand(score: number): "low" | "mid" | "high" {
  if (score < 60) return "low";
  if (score < 85) return "mid";
  return "high";
}
