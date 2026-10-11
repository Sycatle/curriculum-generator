/**
 * Deterministic JD ↔ CV matching.
 *
 * Single-dimension `matchPosting` is the legacy fallback when no targeting
 * profile is defined (keyword coverage only). `matchPostingMulti` blends
 * seven dimensions (keywords/location/remote/seniority/language/employment/
 * role) using the user's targeting profile and applies hard-exclusions.
 *
 * No LLM call here — sub-50ms, zero cost. The agent loop (`lib/ai/`) can
 * come behind to suggest rewrites once the user picks a posting to tailor for.
 */

import { extractJobKeywords, matchKeywords, type JobMatchResult } from "@/lib/cv/job-match";
import type { CvData } from "@/lib/cv/schema";
import type { LlmMatchResult } from "./llm-match";
import type { JobPostingRecord } from "./repository";
import type { TargetingProfile } from "./targeting";

export interface PostingMatch {
  /** 0-100, identical to JobMatchResult.coverage (% must-have keywords present). */
  score: number;
  presentKeywords: string[];
  missingKeywords: string[];
  niceToHaveMissing: string[];
}

export function matchPosting(cv: CvData, descriptionText: string): PostingMatch {
  const keywords = extractJobKeywords(descriptionText);
  const result: JobMatchResult = matchKeywords(cv, keywords);

  const present: string[] = [];
  const missingMust: string[] = [];
  const missingNice: string[] = [];

  for (const m of result.matches) {
    if (m.status === "present") {
      present.push(m.keyword.term);
    } else if (m.keyword.category === "must-have") {
      missingMust.push(m.keyword.term);
    } else if (m.keyword.category === "nice-to-have") {
      missingNice.push(m.keyword.term);
    }
  }

  return {
    score: result.coverage,
    presentKeywords: present,
    missingKeywords: missingMust,
    niceToHaveMissing: missingNice,
  };
}

// ---------------------------------------------------------------------------
// Multi-dimensional scoring (uses user's targeting profile)
// ---------------------------------------------------------------------------

export interface PostingMatchBreakdown {
  /** 0-100 final score, or -1 when excluded (hard reject by profile). */
  total: number;
  excluded: boolean;
  excludeReasons: string[];
  parts: {
    keywords: number; // out of 40
    location: number; // out of 20
    remote: number; // out of 10
    seniority: number; // out of 10
    language: number; // out of 10
    employment: number; // out of 5
    role: number; // out of 5
  };
  presentKeywords: string[];
  missingKeywords: string[];
}

const WEIGHTS: Record<keyof PostingMatchBreakdown["parts"], number> = {
  keywords: 40,
  location: 20,
  remote: 10,
  seniority: 10,
  language: 10,
  employment: 5,
  role: 5,
};

const SENIORITY_REGEXES: Array<{ level: number; rx: RegExp }> = [
  { level: 5, rx: /\b(staff|principal|distinguished|fellow)\b/i },
  { level: 4, rx: /\b(lead|head of|director|architect)\b/i },
  { level: 3, rx: /\b(senior|sr\.?|confirmed?|confirm[ée])\b/i },
  { level: 2, rx: /\b(mid[\s-]?level|intermediate)\b/i },
  { level: 1, rx: /\b(junior|jr\.?|entry[\s-]?level|graduate)\b/i },
  { level: 0, rx: /\b(intern|stage|stagiaire|alternant|apprentice)\b/i },
];

function detectSeniority(title: string): number | null {
  for (const { level, rx } of SENIORITY_REGEXES) {
    if (rx.test(title)) return level;
  }
  return null;
}

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function tokensIncludeAny(haystack: string, needles: readonly string[]): string[] {
  const h = norm(haystack);
  const hits: string[] = [];
  for (const n of needles) {
    const nn = norm(n).trim();
    if (!nn) continue;
    if (h.includes(nn)) hits.push(n);
  }
  return hits;
}

function isRemoteLocationTarget(loc: string): boolean {
  return /\bremote\b|\banywhere\b|\bworldwide\b|\beu\b|\bus\b/.test(norm(loc));
}

export function matchPostingMulti(
  cv: CvData,
  posting: JobPostingRecord,
  profile: TargetingProfile | null,
): PostingMatchBreakdown {
  const haystack = `${posting.title} ${posting.company} ${posting.descriptionText ?? ""}`;
  const baseKw = matchPosting(cv, posting.descriptionText ?? posting.title);

  // No profile → legacy single-dim score, everything else neutral.
  if (!profile) {
    return {
      total: baseKw.score,
      excluded: false,
      excludeReasons: [],
      parts: {
        keywords: baseKw.score,
        location: 0,
        remote: 0,
        seniority: 0,
        language: 0,
        employment: 0,
        role: 0,
      },
      presentKeywords: baseKw.presentKeywords,
      missingKeywords: baseKw.missingKeywords,
    };
  }

  const excludeReasons: string[] = [];

  // --- Hard exclusions ---
  const excludedKw = tokensIncludeAny(haystack, profile.excludeKeywords);
  if (excludedKw.length > 0) {
    excludeReasons.push(`exclude keyword: ${excludedKw.join(", ")}`);
  }
  const excludedCo = tokensIncludeAny(posting.company, profile.excludeCompanies);
  if (excludedCo.length > 0) {
    excludeReasons.push(`exclude company: ${excludedCo.join(", ")}`);
  }
  if (profile.remoteRequired && !posting.remote) {
    excludeReasons.push("remote required, posting is not remote");
  }
  // Seniority hard-exclude only if title clearly states a level outside the band.
  const detectedLevel = detectSeniority(posting.title);
  if (detectedLevel !== null) {
    if (profile.seniorityMin !== null && detectedLevel < profile.seniorityMin) {
      excludeReasons.push(`seniority too low (${detectedLevel} < ${profile.seniorityMin})`);
    }
    if (profile.seniorityMax !== null && detectedLevel > profile.seniorityMax) {
      excludeReasons.push(`seniority too high (${detectedLevel} > ${profile.seniorityMax})`);
    }
  }
  // Required language must be present in JD.
  if (profile.languages.fr === "required" && !/\b(fr|français|francais|french)\b/i.test(haystack)) {
    excludeReasons.push("FR required, not detected in JD");
  }
  if (profile.languages.en === "required" && !/\b(en|english|anglais)\b/i.test(haystack)) {
    excludeReasons.push("EN required, not detected in JD");
  }

  if (excludeReasons.length > 0) {
    return {
      total: -1,
      excluded: true,
      excludeReasons,
      parts: { keywords: 0, location: 0, remote: 0, seniority: 0, language: 0, employment: 0, role: 0 },
      presentKeywords: baseKw.presentKeywords,
      missingKeywords: baseKw.missingKeywords,
    };
  }

  // --- Scoring ---
  // 1) Keywords (40 pts) — scale base score 0-100 to 0-40.
  const keywords = Math.round((baseKw.score * WEIGHTS.keywords) / 100);

  // 2) Location (20 pts).
  let location = 0;
  if (profile.targetLocations.length === 0) {
    location = WEIGHTS.location; // user didn't restrict → neutral full
  } else {
    const postLoc = posting.location ?? "";
    const hit = tokensIncludeAny(postLoc, profile.targetLocations);
    if (hit.length > 0) {
      location = WEIGHTS.location;
    } else if (posting.remote && profile.targetLocations.some(isRemoteLocationTarget)) {
      location = WEIGHTS.location;
    } else {
      location = 0;
    }
  }

  // 3) Remote (10 pts).
  const remote = profile.remoteRequired ? (posting.remote ? WEIGHTS.remote : 0) : posting.remote ? WEIGHTS.remote : 5;

  // 4) Seniority (10 pts) — full if within band or unspecified, else proportional decay.
  let seniority = WEIGHTS.seniority;
  if (detectedLevel !== null && (profile.seniorityMin !== null || profile.seniorityMax !== null)) {
    const lo = profile.seniorityMin ?? 0;
    const hi = profile.seniorityMax ?? 5;
    if (detectedLevel >= lo && detectedLevel <= hi) seniority = WEIGHTS.seniority;
    else {
      const dist = detectedLevel < lo ? lo - detectedLevel : detectedLevel - hi;
      seniority = Math.max(0, WEIGHTS.seniority - dist * 4);
    }
  }

  // 5) Language (10 pts).
  let language = WEIGHTS.language;
  const wantFr = profile.languages.fr;
  const wantEn = profile.languages.en;
  if (wantFr || wantEn) {
    const hasFr = /\b(fr|français|francais|french)\b/i.test(haystack);
    const hasEn = /\b(en|english|anglais)\b/i.test(haystack);
    let score = 0;
    let max = 0;
    if (wantFr) {
      max += 5;
      if (hasFr) score += 5;
      else if (wantFr === "nice") score += 2;
    }
    if (wantEn) {
      max += 5;
      if (hasEn) score += 5;
      else if (wantEn === "nice") score += 2;
    }
    language = max > 0 ? Math.round((score * WEIGHTS.language) / max) : WEIGHTS.language;
  }

  // 6) Employment (5 pts) — match against profile.employmentTypes.
  let employment = WEIGHTS.employment;
  if (profile.employmentTypes.length > 0) {
    const pt = norm(posting.employmentType);
    const hit = profile.employmentTypes.some((t) => pt.includes(norm(t)));
    employment = hit ? WEIGHTS.employment : 0;
  }

  // 7) Role (5 pts) — any targetRoles token in title.
  let role = 0;
  if (profile.targetRoles.length === 0) {
    role = WEIGHTS.role;
  } else {
    role = tokensIncludeAny(posting.title, profile.targetRoles).length > 0 ? WEIGHTS.role : 0;
  }

  const total = keywords + location + remote + seniority + language + employment + role;

  return {
    total: Math.max(0, Math.min(100, total)),
    excluded: false,
    excludeReasons: [],
    parts: { keywords, location, remote, seniority, language, employment, role },
    presentKeywords: baseKw.presentKeywords,
    missingKeywords: baseKw.missingKeywords,
  };
}

// ---------------------------------------------------------------------------
// Final score blending — deterministic + LLM + structured-signal hard excludes
// ---------------------------------------------------------------------------

export interface PostingMatchFinal extends PostingMatchBreakdown {
  llm?: LlmMatchResult | null;
  /** Final blended total persisted into job_posting.fit_score. */
  finalTotal: number;
}

const DET_WEIGHT = 0.4;
const LLM_WEIGHT = 0.6;

/**
 * Combine the deterministic breakdown with optional LLM result and apply
 * additional hard-exclusions that depend on typed signals (alternance,
 * salary range) which `matchPostingMulti` doesn't see directly.
 */
export function matchPostingFinal(
  cv: CvData,
  posting: JobPostingRecord,
  profile: TargetingProfile | null,
  llm: LlmMatchResult | null = null,
): PostingMatchFinal {
  const det = matchPostingMulti(cv, posting, profile);

  // Already excluded by deterministic pass → keep exclusion, ignore LLM.
  if (det.excluded) {
    return { ...det, llm, finalTotal: -1 };
  }

  const extraReasons: string[] = [];

  // Hard-exclude: alternance flag + profile says no
  if (profile?.excludeAlternance && posting.isAlternance === true) {
    extraReasons.push("alternance excluded by profile");
  }

  // Hard-exclude: posting's max salary below profile's floor
  if (
    profile?.salaryMinEUR != null &&
    profile.salaryMinEUR > 0 &&
    posting.salaryMaxEUR != null &&
    // Only compare for yearly periods (skip if unknown to avoid false drops)
    posting.salaryPeriod === "year" &&
    posting.salaryMaxEUR < profile.salaryMinEUR
  ) {
    extraReasons.push(
      `salary ${posting.salaryMaxEUR}€ below floor ${profile.salaryMinEUR}€`,
    );
  }

  // Hard-exclude: LLM verdict mismatch
  if (llm?.verdict === "mismatch") {
    extraReasons.push(
      llm.reasons.length > 0
        ? `LLM mismatch: ${llm.reasons.slice(0, 2).join("; ")}`
        : "LLM mismatch",
    );
  }

  if (extraReasons.length > 0) {
    return {
      ...det,
      excluded: true,
      excludeReasons: [...det.excludeReasons, ...extraReasons],
      total: -1,
      llm,
      finalTotal: -1,
    };
  }

  // Blend score
  let blended = det.total;
  if (llm) {
    blended = Math.round(DET_WEIGHT * det.total + LLM_WEIGHT * llm.score);
    blended = Math.max(0, Math.min(100, blended));
  }

  return { ...det, total: blended, llm, finalTotal: blended };
}
