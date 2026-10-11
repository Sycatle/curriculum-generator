/**
 * Job-description matching — déterministe, sans appel IA.
 *
 * Le tailoring est la feature attendue par tous les concurrents 2026 (Teal,
 * Huntr, Jobscan, Kickresume). Ici on extrait les "mots-clés" de la fiche de
 * poste, on les normalise (acronymes ↔ formes longues), puis on les compare
 * au texte complet du CV pour produire un diff visuel.
 *
 * Pourquoi déterministe : feedback < 50 ms, pas de coût IA, pas de
 * fabrication. Le LLM peut venir derrière via `tailor_for_job` (chat tool)
 * pour proposer des réécritures de bullets.
 */

import type { CvData } from "./schema";

/** Mots vides FR + EN — on ignore pour le matching. */
const STOPWORDS = new Set([
  // EN
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "that",
  "this", "from", "have", "has", "we", "us", "or", "in", "on", "to", "of",
  "a", "an", "is", "be", "by", "as", "at", "it", "all", "any", "can", "do",
  "their", "they", "them", "who", "what", "when", "where", "how", "than",
  "but", "not", "no", "if", "so", "more", "most", "such", "also", "into",
  // FR
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "à", "au",
  "aux", "pour", "avec", "sans", "dans", "sur", "par", "en", "votre", "vos",
  "notre", "nos", "leur", "leurs", "ils", "elles", "vous", "nous", "qui",
  "que", "qu", "ce", "ces", "cet", "cette", "il", "elle", "on", "se", "sa",
  "son", "ses", "son", "est", "sont", "ne", "pas", "plus", "moins", "très",
  "dont", "ainsi", "aussi", "tout", "tous", "comme", "afin", "être", "avoir",
]);

/** Synonymes / acronymes connus pour matcher AWS ↔ Amazon Web Services, etc. */
// Le premier élément de chaque groupe sert de forme canonique (chip affichée).
// Mettre la forme longue/lisible en tête, l'acronyme en second.
const SYNONYMS: ReadonlyArray<readonly string[]> = [
  ["aws", "amazon web services"],
  ["gcp", "google cloud platform", "google cloud"],
  ["kubernetes", "k8s"],
  ["javascript", "js"],
  ["typescript", "ts"],
  ["python", "py"],
  ["ci/cd", "cicd", "continuous integration", "continuous deployment"],
  ["machine learning", "ml"],
  ["ai", "artificial intelligence"],
  ["llm", "large language model"],
  ["api", "rest api", "graphql api"],
  ["postgresql", "postgres"],
  ["mongodb"],
  ["devops"],
  ["ux/ui", "ux", "ui", "ui/ux"],
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalize(token: string): string {
  const t = normalize(token);
  for (const group of SYNONYMS) {
    if (group.includes(t)) return group[0]!;
  }
  return t;
}

/**
 * Extrait des "n-grams candidats" (1-3 mots) en gardant ceux qui ressemblent
 * à un keyword métier : capitalisation initiale dans le JD, ou bigram
 * tech-typique, ou présence dans une liste de stop-techs.
 */
function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .map((w) => w.replace(/^[.,;:!?]+|[.,;:!?]+$/g, ""))
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

const KNOWN_TECH = new Set([
  "react", "vue", "svelte", "angular", "next", "nuxt", "remix", "astro",
  "node", "deno", "bun", "express", "fastify", "nest",
  "python", "django", "flask", "fastapi", "ruby", "rails", "go", "rust",
  "java", "kotlin", "scala", "spring", "php", "laravel", "swift",
  "typescript", "javascript",
  "postgres", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
  "kafka", "rabbitmq",
  "docker", "kubernetes", "k8s", "terraform", "ansible", "helm",
  "aws", "gcp", "azure", "cloudflare", "vercel", "netlify", "fly",
  "drizzle", "prisma", "sequelize", "knex", "typeorm",
  "graphql", "rest", "grpc", "websocket", "trpc",
  "stripe", "supabase", "firebase", "auth0", "clerk",
  "tailwind", "css", "sass", "less", "shadcn",
  "jest", "vitest", "playwright", "cypress", "mocha",
  "linux", "bash", "git", "github", "gitlab", "bitbucket",
  "figma", "sketch", "framer", "webflow",
  "ml", "ai", "llm", "embeddings", "rag", "openai", "anthropic", "claude",
  "ux", "ui", "a11y", "i18n", "seo",
]);

const SOFT_SKILLS = new Set([
  "leadership", "ownership", "communication", "mentoring", "collaboration",
  "autonomy", "ownership", "initiative",
  "leadership", "autonomie", "communication", "mentorat",
]);

export type Keyword = {
  term: string;
  category: "must-have" | "nice-to-have" | "soft";
  /** Variantes orthographiques détectées (pour explication UX). */
  variants: string[];
};

/**
 * Où le mot-clé est prouvé : `experience` (expériences ou projets),
 * `summary` (résumé, sans preuve en expérience), `skills-only` (uniquement
 * listé dans les compétences). `null` si absent ou seulement en-tête/formation.
 */
export type Provenance = "experience" | "skills-only" | "summary";

export type KeywordMatch = {
  keyword: Keyword;
  status: "present" | "missing" | "weak";
  /** Sections du CV où le keyword apparaît, si présent. */
  foundIn: string[];
  provenance: Provenance | null;
};

export type JobMatchResult = {
  keywords: Keyword[];
  matches: KeywordMatch[];
  /** Score 0-100 = % de must-have présents. */
  coverage: number;
  /** Mots-clés manquants priorisés (must-have d'abord). */
  gaps: Keyword[];
};

/**
 * Extrait jusqu'à ~25 mots-clés d'une fiche de poste. Heuristiques :
 * - "required", "must have" → must-have
 * - "nice to have", "bonus", "plus" → nice-to-have
 * - tokens dans KNOWN_TECH (priorité haute)
 * - tokens fréquents (> 2 occurrences) sinon
 */
export function extractJobKeywords(jobDescription: string): Keyword[] {
  const text = normalize(jobDescription);
  const lines = jobDescription.split(/\n+/);

  const mustHaveLines = new Set<string>();
  const niceToHaveLines = new Set<string>();
  let mode: "must" | "nice" | "neutral" = "neutral";
  for (const raw of lines) {
    const l = normalize(raw);
    if (/^(required|must[\s-]?have|requirements|exigences|requis)/i.test(l)) mode = "must";
    else if (/^(nice[\s-]?to[\s-]?have|bonus|plus|preferred|appréciable|atout)/i.test(l))
      mode = "nice";
    else if (/^(about|qui sommes|company|culture|benefits|avantages)/i.test(l))
      mode = "neutral";

    if (mode === "must") mustHaveLines.add(l);
    if (mode === "nice") niceToHaveLines.add(l);
  }

  const tokens = tokenize(text);

  // Compter fréquence
  const freq = new Map<string, number>();
  for (const t of tokens) {
    const c = canonicalize(t);
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }

  // Construire keywords
  const result: Keyword[] = [];
  const seen = new Set<string>();

  function add(term: string, category: Keyword["category"]) {
    const canon = canonicalize(term);
    if (seen.has(canon)) return;
    seen.add(canon);
    const variants = SYNONYMS.find((g) => g.includes(canon)) ?? [canon];
    result.push({ term: canon, category, variants: [...variants] });
  }

  // 1) Tech keywords (toujours must-have ou nice-have selon source line)
  for (const [token] of freq) {
    if (KNOWN_TECH.has(token)) {
      const inMust = [...mustHaveLines].some((l) => l.includes(token));
      const inNice = [...niceToHaveLines].some((l) => l.includes(token));
      add(token, inNice && !inMust ? "nice-to-have" : "must-have");
    }
  }

  // 2) Soft skills
  for (const [token] of freq) {
    if (SOFT_SKILLS.has(token)) add(token, "soft");
  }

  // 3) Compléter avec tokens fréquents (>=3)
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  for (const [token, count] of sorted) {
    if (result.length >= 25) break;
    if (seen.has(token)) continue;
    if (count < 3) continue;
    if (token.length < 3) continue;
    add(token, "nice-to-have");
  }

  return result;
}

/** Texte complet du CV pour matching (concatène tout le texte exploitable). */
function cvFullText(data: CvData): { sectionTexts: Map<string, string> } {
  const sections = new Map<string, string>();
  sections.set("header", `${data.header.name} ${data.header.title}`);
  if (data.summary) sections.set("summary", data.summary);
  sections.set(
    "skills",
    data.skills.map((g) => `${g.category} ${g.items.join(" ")}`).join(" "),
  );
  sections.set(
    "experiences",
    data.experiences
      .map(
        (e) =>
          `${e.role} ${e.company} ${e.summary ?? ""} ${e.bullets.join(" ")} ${e.stack.join(" ")}`,
      )
      .join(" "),
  );
  sections.set(
    "projects",
    data.projects.map((p) => `${p.name} ${p.description} ${p.stack.join(" ")}`).join(" "),
  );
  sections.set(
    "education",
    data.education.map((e) => `${e.degree} ${e.school} ${e.details ?? ""}`).join(" "),
  );
  return { sectionTexts: sections };
}

export function matchKeywords(data: CvData, keywords: Keyword[]): JobMatchResult {
  const { sectionTexts } = cvFullText(data);
  const normalizedSections = new Map<string, string>();
  for (const [k, v] of sectionTexts) normalizedSections.set(k, normalize(v));

  const matches: KeywordMatch[] = keywords.map((kw) => {
    const foundIn: string[] = [];
    let totalOccur = 0;
    for (const variant of kw.variants) {
      const v = normalize(variant);
      const rx = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      for (const [section, text] of normalizedSections) {
        const occ = (text.match(rx) ?? []).length;
        if (occ > 0) {
          totalOccur += occ;
          if (!foundIn.includes(section)) foundIn.push(section);
        }
      }
    }
    let status: KeywordMatch["status"];
    if (totalOccur === 0) status = "missing";
    else if (totalOccur === 1 && kw.category === "must-have") status = "weak";
    else status = "present";
    return { keyword: kw, status, foundIn, provenance: provenanceOf(foundIn) };
  });

  const mustHaves = matches.filter((m) => m.keyword.category === "must-have");
  const presentMust = mustHaves.filter((m) => m.status !== "missing").length;
  const coverage = mustHaves.length === 0 ? 100 : Math.round((presentMust / mustHaves.length) * 100);

  const gaps = matches
    .filter((m) => m.status === "missing")
    .sort((a, b) => categoryWeight(a.keyword) - categoryWeight(b.keyword))
    .map((m) => m.keyword);

  return { keywords, matches, coverage, gaps };
}

function provenanceOf(foundIn: string[]): Provenance | null {
  if (foundIn.includes("experiences") || foundIn.includes("projects")) return "experience";
  if (foundIn.includes("summary")) return "summary";
  if (foundIn.includes("skills")) return "skills-only";
  return null;
}

function categoryWeight(k: Keyword): number {
  return k.category === "must-have" ? 0 : k.category === "nice-to-have" ? 1 : 2;
}
