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

export function computeAtsScore(data: CvData): AtsScoreResult {
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
      else if (!STRONG_VERBS.has(w) && !/ed$|ied$/i.test(w)) noVerb++;
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
  ]);
  const contentImpact = sum([
    "bullets.no-verb",
    "bullets.no-metric",
    "bullets.weak-verb",
    "bullets.too-long",
    "bullets.passive",
    "experiences.empty-bullets",
  ]);
  const formattingImpact = sum([
    "photo.present",
    "languages.too-many",
    "skills.too-many",
    "skills.too-few-groups",
    "skills.generic",
    "dates.bad-format",
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
