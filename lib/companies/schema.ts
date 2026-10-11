/**
 * Normalized Company + Contact shapes — every discovery source must produce
 * NormalizedCompany. Enrichers (Dropcontact/Hunter) produce NormalizedContact.
 */

import { z } from "zod";

export const NormalizedCompanySchema = z.object({
  externalId: z.string().min(1),
  source: z.string().min(1), // 'recherche-entreprises', 'apify-gmaps', ...
  name: z.string().min(1),
  domain: z.string().nullish(),
  country: z.string().length(2).nullish(),
  city: z.string().nullish(),
  postalCode: z.string().nullish(),
  activityCode: z.string().nullish(),
  activityLabel: z.string().nullish(),
  headcount: z.string().nullish(),
  headcountMin: z.number().int().nullish(),
  headcountMax: z.number().int().nullish(),
  raw: z.record(z.string(), z.unknown()),
});

export type NormalizedCompany = z.infer<typeof NormalizedCompanySchema>;

export type CompanySourceKind = "recherche-entreprises" | "apify-gmaps" | "manual";

export interface CompanySourceConnector<TConfig = unknown> {
  kind: CompanySourceKind;
  fetch(config: TConfig): Promise<NormalizedCompany[]>;
}

// Connector configs

// (Apify Google Maps config lives in sources/apify-gmaps.ts to avoid a circular import.)

export const RechercheEntreprisesConfigSchema = z.object({
  /** Free-text search (e.g. "intelligence artificielle"). */
  q: z.string().optional(),
  /** NAF code (e.g. "62.01Z" for "Programmation informatique"). */
  activitePrincipale: z.string().optional(),
  /** "J" for "Information & communication" (broader than NAF). */
  sectionActivitePrincipale: z.string().optional(),
  /** INSEE commune code (per arrondissement for Paris/Lyon/Marseille). */
  codeCommune: z.string().optional(),
  /** Postal code — the actual hard filter (e.g. "75008", "69002"). */
  codePostal: z.string().optional(),
  /** Department code — used as a fallback `q` substring; the API has no dept filter. */
  departement: z.string().optional(),
  /** Headcount filter: 0, 1, 2, 3, 11, 12, 21, 22, 31, 32, 41, 42, 51, 52, 53. */
  trancheEffectifSalarie: z.string().optional(),
  /** Etat administratif (A=active, C=cessée). Default A. */
  etatAdministratif: z.enum(["A", "C"]).default("A"),
  /** Page size — max 25. */
  perPage: z.number().int().min(1).max(25).default(25),
  /** Pages to fetch sequentially (1..N). Default 4 → up to 100 results. */
  maxPages: z.number().int().min(1).max(20).default(4),
});
export type RechercheEntreprisesConfig = z.infer<typeof RechercheEntreprisesConfigSchema>;
