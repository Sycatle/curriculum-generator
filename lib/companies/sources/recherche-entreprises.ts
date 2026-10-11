/**
 * recherche-entreprises.api.gouv.fr connector.
 *
 * Free, no auth, public service. Source of truth for all active French
 * legal entities (SIREN + SIRET + activity code NAF + headcount + addr).
 *
 * Endpoint:
 *   GET https://recherche-entreprises.api.gouv.fr/search
 *     ?activite_principale=62.01Z
 *     &etat_administratif=A
 *     &per_page=25&page=1
 *
 * Headcount labels (tranche_effectif_salarie) — INSEE codes:
 *   00 = 0,  01 = 1-2,  02 = 3-5,  03 = 6-9,
 *   11 = 10-19, 12 = 20-49,
 *   21 = 50-99, 22 = 100-199,
 *   31 = 200-249, 32 = 250-499,
 *   41 = 500-999, 42 = 1000-1999,
 *   51 = 2000-4999, 52 = 5000-9999, 53 = >=10000.
 */

import type {
  CompanySourceConnector,
  NormalizedCompany,
  RechercheEntreprisesConfig,
} from "../schema";

interface ReSiege {
  siret?: string;
  commune?: string;
  libelle_commune?: string;
  code_postal?: string;
  departement?: string;
  region?: string;
  pays?: string;
}

interface ReResult {
  siren: string;
  nom_complet: string;
  nom_raison_sociale?: string;
  sigle?: string;
  activite_principale?: string;
  section_activite_principale?: string;
  tranche_effectif_salarie?: string;
  date_creation?: string;
  etat_administratif?: string;
  nature_juridique?: string;
  siege?: ReSiege;
  matching_etablissements?: ReSiege[];
  complements?: {
    site_web?: string;
    est_societe_mission?: boolean;
  };
}

interface ReResponse {
  results: ReResult[];
  total_results: number;
  page: number;
  total_pages: number;
}

const HEADCOUNT_RANGE: Record<string, { min: number; max: number; label: string }> = {
  "00": { min: 0, max: 0, label: "0 salarié" },
  "01": { min: 1, max: 2, label: "1 à 2 salariés" },
  "02": { min: 3, max: 5, label: "3 à 5 salariés" },
  "03": { min: 6, max: 9, label: "6 à 9 salariés" },
  "11": { min: 10, max: 19, label: "10 à 19 salariés" },
  "12": { min: 20, max: 49, label: "20 à 49 salariés" },
  "21": { min: 50, max: 99, label: "50 à 99 salariés" },
  "22": { min: 100, max: 199, label: "100 à 199 salariés" },
  "31": { min: 200, max: 249, label: "200 à 249 salariés" },
  "32": { min: 250, max: 499, label: "250 à 499 salariés" },
  "41": { min: 500, max: 999, label: "500 à 999 salariés" },
  "42": { min: 1000, max: 1999, label: "1 000 à 1 999 salariés" },
  "51": { min: 2000, max: 4999, label: "2 000 à 4 999 salariés" },
  "52": { min: 5000, max: 9999, label: "5 000 à 9 999 salariés" },
  "53": { min: 10000, max: 999999, label: "10 000 salariés et plus" },
};

function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export const rechercheEntreprisesConnector: CompanySourceConnector<RechercheEntreprisesConfig> = {
  kind: "recherche-entreprises",
  async fetch(config) {
    const all: NormalizedCompany[] = [];
    const perPage = config.perPage ?? 25;
    const maxPages = config.maxPages ?? 4;

    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams();
      if (config.q) params.set("q", config.q);
      if (config.activitePrincipale) params.set("activite_principale", config.activitePrincipale);
      if (config.sectionActivitePrincipale)
        params.set("section_activite_principale", config.sectionActivitePrincipale);
      if (config.codePostal) params.set("code_postal", config.codePostal);
      if (config.codeCommune) params.set("code_commune", config.codeCommune);
      if (config.trancheEffectifSalarie)
        params.set("tranche_effectif_salarie", config.trancheEffectifSalarie);
      params.set("etat_administratif", config.etatAdministratif ?? "A");
      params.set("per_page", String(perPage));
      params.set("page", String(page));

      const url = `https://recherche-entreprises.api.gouv.fr/search?${params.toString()}`;
      const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Recherche-entreprises: HTTP ${res.status} (page ${page})`);
      }
      const data = (await res.json()) as ReResponse;
      const results = data.results ?? [];

      for (const r of results) {
        const siege = r.siege ?? r.matching_etablissements?.[0];
        const tr = r.tranche_effectif_salarie;
        const headcountInfo = tr ? HEADCOUNT_RANGE[tr] : null;
        all.push({
          externalId: r.siren,
          source: "recherche-entreprises",
          name: r.nom_complet ?? r.nom_raison_sociale ?? r.siren,
          domain: extractDomain(r.complements?.site_web),
          country: "FR",
          city: siege?.libelle_commune ?? null,
          postalCode: siege?.code_postal ?? null,
          activityCode: r.activite_principale ?? null,
          activityLabel: r.section_activite_principale ?? null,
          headcount: headcountInfo?.label ?? null,
          headcountMin: headcountInfo?.min ?? null,
          headcountMax: headcountInfo?.max ?? null,
          raw: r as unknown as Record<string, unknown>,
        });
      }

      if (page >= data.total_pages) break;
      if (results.length < perPage) break;
    }

    return all;
  },
};
