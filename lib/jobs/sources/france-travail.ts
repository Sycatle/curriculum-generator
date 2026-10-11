/**
 * France Travail "Offres d'emploi v2" API connector.
 *
 * Requires OAuth client_credentials with scope `api_offresdemploiv2 o2dsoffre`.
 * Register at francetravail.io. Cache the bearer for ~25 min.
 *
 * Env:
 *   FRANCE_TRAVAIL_CLIENT_ID
 *   FRANCE_TRAVAIL_CLIENT_SECRET
 *
 * Enriched mapping: we extract `alternance`, `salaire` (parsed to min/max EUR),
 * `experienceExige` + `experienceLibelle` (parsed to months), `contexteTravail`,
 * `appellationlibelle`, `romeCode`, `dateActualisation`, accessibility flags
 * and `nombrePostes` into typed columns so downstream filtering doesn't have
 * to peek into `raw`.
 */

import type { FranceTravailConfig, NormalizedPosting, SourceConnector } from "../schema";
import { applyIngestFilter } from "./ingest-filter";

interface FtToken {
  access_token: string;
  expires_in: number; // seconds
  fetchedAt: number;
}

let cachedToken: FtToken | null = null;

async function getToken(): Promise<string> {
  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET not set");
  }

  if (cachedToken) {
    const ageSec = (Date.now() - cachedToken.fetchedAt) / 1000;
    if (ageSec < cachedToken.expires_in - 60) {
      return cachedToken.access_token;
    }
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "api_offresdemploiv2 o2dsoffre",
  });

  const res = await fetch(
    "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: string; error_description?: string };
      detail = parsed.error_description ?? parsed.error ?? text;
    } catch {
      // not JSON, use raw
    }
    throw new Error(`France Travail token: HTTP ${res.status} — ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { ...data, fetchedAt: Date.now() };
  return data.access_token;
}

interface FtOffre {
  id: string;
  intitule: string;
  description?: string;
  dateCreation: string;
  dateActualisation?: string;
  lieuTravail?: { libelle?: string; codePostal?: string; commune?: string };
  typeContrat?: string;
  typeContratLibelle?: string;
  natureContrat?: string;
  alternance?: boolean;
  salaire?: { libelle?: string; commentaire?: string; complement1?: string; complement2?: string };
  experienceExige?: string; // "D" debutant | "S" souhaité | "E" exigé
  experienceLibelle?: string;
  entreprise?: { nom?: string; description?: string };
  origineOffre?: { urlOrigine?: string; partenaires?: { url?: string }[] };
  contexteTravail?: { horaires?: { libelle?: string }[]; deplacementCode?: string; deplacementLibelle?: string; conditionExercice?: string[] };
  romeCode?: string;
  romeLibelle?: string;
  appellationlibelle?: string;
  accessibleTH?: boolean;
  entrepriseAdaptee?: boolean;
  employeurHandiEngage?: boolean;
  nombrePostes?: number;
}

interface FtResponse {
  resultats: FtOffre[];
}

const REMOTE_RE = /\b(t[ée]l[ée]travail|remote|full remote|100 ?% ?remote)\b/i;

// ---------------------------------------------------------------------------
// Salary parsing — FT libelle is unstructured. Best-effort patterns:
//   "Annuel de 35000 Euros à 45000 Euros sur 12 mois"
//   "Mensuel de 2500€ à 3000€"
//   "Annuel de 45K€ à 60K€"
//   "Horaire 12,50€"
//   "Annuel 35000 Euros"
// ---------------------------------------------------------------------------

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  period: "year" | "month" | "day" | "hour" | null;
  raw: string;
}

const PERIOD_RE: Array<{ rx: RegExp; period: ParsedSalary["period"] }> = [
  { rx: /annuel/i, period: "year" },
  { rx: /mensuel/i, period: "month" },
  { rx: /horaire/i, period: "hour" },
  { rx: /journalier|jour/i, period: "day" },
];

const AMOUNT_RE = /(\d[\d\s.,]*)\s*(K)?\s*(?:€|euros?|EUR)/gi;

export function parseSalary(libelle: string | undefined | null): ParsedSalary | null {
  if (!libelle) return null;
  const raw = libelle.trim();
  if (!raw) return null;

  let period: ParsedSalary["period"] = null;
  for (const { rx, period: p } of PERIOD_RE) {
    if (rx.test(raw)) {
      period = p;
      break;
    }
  }

  const amounts: number[] = [];
  for (const m of raw.matchAll(AMOUNT_RE)) {
    const numStr = (m[1] ?? "").replace(/\s+/g, "").replace(",", ".");
    const n = Number(numStr);
    if (!Number.isFinite(n)) continue;
    const isK = (m[2] ?? "").toUpperCase() === "K";
    const value = isK ? Math.round(n * 1000) : Math.round(n);
    if (value > 0) amounts.push(value);
  }

  if (amounts.length === 0) {
    return { min: null, max: null, period, raw };
  }
  const min = Math.min(...amounts);
  const max = amounts.length > 1 ? Math.max(...amounts) : null;
  return { min, max, period, raw };
}

// ---------------------------------------------------------------------------
// Experience parsing — `experienceLibelle` typical patterns:
//   "3 An(s)" → 36
//   "6 mois" → 6
//   "1 An" → 12
//   "Débutant accepté" → 0
// ---------------------------------------------------------------------------

export function parseExperienceMonths(libelle: string | undefined | null): number | null {
  if (!libelle) return null;
  const s = libelle.toLowerCase();
  if (/d[ée]butant/.test(s)) return 0;
  const m = s.match(/(\d+)\s*(an|mois)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === "an" ? n * 12 : n;
}

export const franceTravailConnector: SourceConnector<FranceTravailConfig> = {
  kind: "france-travail",
  async fetch(config) {
    const token = await getToken();

    const params = new URLSearchParams();
    if (config.motsCles) params.set("motsCles", config.motsCles);
    if (config.codeROME) params.set("codeROME", config.codeROME);
    if (config.commune) params.set("commune", config.commune);
    if (config.departement) params.set("departement", config.departement);
    if (config.region) params.set("region", config.region);
    if (config.typeContrat) params.set("typeContrat", config.typeContrat);
    if (config.teletravail === true) params.set("teletravail", "true");
    if (config.publieeDepuis) params.set("publieeDepuis", String(config.publieeDepuis));
    const max = config.maxResults ?? 50;
    params.set("range", `0-${Math.max(0, max - 1)}`);

    const url = `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok && res.status !== 206) {
      throw new Error(`France Travail search: HTTP ${res.status}`);
    }
    const data = (await res.json()) as FtResponse;
    const offres = data.resultats ?? [];

    const mapped = offres.map<NormalizedPosting>((o) => {
      const desc = o.description ?? "";
      const remote = REMOTE_RE.test(desc) || REMOTE_RE.test(o.intitule);
      const externalUrl =
        o.origineOffre?.urlOrigine ??
        o.origineOffre?.partenaires?.[0]?.url ??
        `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`;

      const isAlternance =
        o.alternance === true ||
        /alternance|apprentissage/i.test(o.typeContratLibelle ?? "") ||
        /alternance|apprentissage/i.test(o.typeContrat ?? "");

      const salary = parseSalary(o.salaire?.libelle);
      const experienceMonths = parseExperienceMonths(o.experienceLibelle);

      return {
        externalId: o.id,
        url: externalUrl,
        title: o.intitule,
        company: o.entreprise?.nom ?? "—",
        location: o.lieuTravail?.libelle ?? null,
        remote,
        employmentType: o.typeContratLibelle ?? o.typeContrat ?? null,
        department: o.romeLibelle ?? null,
        descriptionHtml: null,
        descriptionText: desc,
        postedAt: o.dateCreation ? new Date(o.dateCreation) : null,
        raw: o as unknown as Record<string, unknown>,
        // Enriched typed signals
        isAlternance,
        salaryMinEUR: salary?.min ?? null,
        salaryMaxEUR: salary?.max ?? null,
        salaryPeriod: salary?.period ?? null,
        salaryRaw: salary?.raw ?? null,
        experienceRequiredMonths: experienceMonths,
        experienceLabel: o.experienceLibelle ?? null,
        workContext: (o.contexteTravail as Record<string, unknown> | undefined) ?? null,
        appellationLibelle: o.appellationlibelle ?? null,
        romeCode: o.romeCode ?? null,
        dateActualisation: o.dateActualisation ? new Date(o.dateActualisation) : null,
        accessibleTH: o.accessibleTH ?? null,
        entrepriseAdaptee: o.entrepriseAdaptee ?? null,
        employeurHandiEngage: o.employeurHandiEngage ?? null,
        nombrePostes: o.nombrePostes ?? null,
      };
    });
    return applyIngestFilter(mapped, config);
  },
};
