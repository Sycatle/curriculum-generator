/**
 * Lint d'un bullet de CV. Indépendant de React, utilisable côté serveur ou
 * client. Source de vérité : "Action verb + Tech + Impact + Scope".
 */

import { LIMITS } from "./limits";

const STRONG_VERBS = new Set([
  "built", "designed", "shipped", "led", "owned", "architected", "migrated",
  "reduced", "increased", "improved", "scaled", "launched", "delivered",
  "implemented", "developed", "automated", "refactored", "optimized",
  "deployed", "created", "engineered", "drove", "founded", "rebuilt",
  "modernized", "redesigned", "introduced", "spearheaded", "rolled",
  "conçu", "construit", "livré", "lancé", "dirigé", "implémenté",
  "réduit", "augmenté", "amélioré", "migré", "automatisé", "déployé",
  "refondu", "optimisé", "développé", "piloté", "structuré",
]);

const WEAK_VERBS = new Set([
  "helped", "assisted", "participated", "worked", "responsible",
  "supported", "involved", "duties", "various",
  "aidé", "participé", "travaillé", "contribué", "responsable",
]);

// Voix passive : auxiliary be + past participle (régulier en -ed/-ied ou irrégulier).
const IRREGULAR_PARTICIPLES = [
  "built", "rebuilt", "made", "written", "taken", "given", "broken", "sold",
  "kept", "led", "told", "sent", "spent", "shown", "thrown", "drawn",
  "chosen", "found", "held", "drove", "driven", "ran", "run",
];
const PASSIVE_PATTERNS = [
  /\b(was|were|been|being|is|are)\s+\w+(ed|ied)\b/i,
  new RegExp(`\\b(was|were|been|being|is|are)\\s+(${IRREGULAR_PARTICIPLES.join("|")})\\b`, "i"),
];

export type BulletWarning =
  | "weak-verb"
  | "no-strong-verb"
  | "no-metric"
  | "too-long"
  | "too-short"
  | "passive"
  | "buzzword";

export type BulletLint = {
  warnings: BulletWarning[];
  /** 0-100, plus c'est haut, mieux c'est. */
  quality: number;
};

function firstWord(text: string): string {
  const m = text.trim().match(/^[\p{L}'’-]+/u);
  return m ? m[0].toLowerCase() : "";
}

function hasMetric(text: string): boolean {
  if (/\d{2,}|\d+%|\d+x|\d+\s*(ms|s|min|h|k|M|MAU|DAU|req|qps|rps|users|customers|€|\$)/i.test(text))
    return true;
  if (/~\s*\d+|\d+\s*(million|billion|thousand)/i.test(text)) return true;
  return false;
}

const BUZZWORDS = /\b(synergy|leverage|paradigm|disruptive|ninja|rockstar|guru|game[\s-]?changer)\b/i;

export function lintBullet(text: string): BulletLint {
  const warnings: BulletWarning[] = [];
  const trimmed = text.trim();

  if (trimmed.length < 25) warnings.push("too-short");
  if (trimmed.length > LIMITS.bulletChars.hard) warnings.push("too-long");

  const w = firstWord(trimmed);
  if (WEAK_VERBS.has(w)) warnings.push("weak-verb");
  else if (!STRONG_VERBS.has(w) && !/ed$|ied$/i.test(w)) warnings.push("no-strong-verb");

  if (!hasMetric(trimmed)) warnings.push("no-metric");
  if (PASSIVE_PATTERNS.some((rx) => rx.test(trimmed))) warnings.push("passive");
  if (BUZZWORDS.test(trimmed)) warnings.push("buzzword");

  // quality score = 100 - 15 per warning, clamped.
  const quality = Math.max(0, 100 - warnings.length * 15);
  return { warnings, quality };
}

export const WARNING_LABEL: Record<BulletWarning, string> = {
  "weak-verb": "Verbe faible (helped, responsible…). Préfère Built/Shipped/Reduced.",
  "no-strong-verb": "Commence par un verbe d'action fort au passé (Built, Designed…).",
  "no-metric": "Aucun chiffre. Ajoute une métrique (ms, %, MAU, $…).",
  "too-long": "Trop long — coupe pour rester scannable.",
  "too-short": "Trop court — détaille l'action, la stack, l'impact.",
  passive: "Voix passive — réécris à l'actif.",
  buzzword: "Buzzword détecté — préfère des faits concrets.",
};
