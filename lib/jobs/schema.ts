/**
 * Normalized job posting shape — every connector must produce this.
 *
 * Connector-specific raw payload is stored separately in `raw` for debugging
 * and future re-extraction without re-fetching.
 */

import { z } from "zod";
import { IngestFilterSchema } from "./sources/ingest-filter";

export const NormalizedPostingSchema = z.object({
  externalId: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullish(),
  remote: z.boolean().default(false),
  employmentType: z.string().nullish(),
  department: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
  descriptionText: z.string().nullish(),
  postedAt: z.date().nullish(),
  raw: z.record(z.string(), z.unknown()),
  // Optional typed signals (currently populated by France Travail only)
  isAlternance: z.boolean().nullish(),
  salaryMinEUR: z.number().int().nullish(),
  salaryMaxEUR: z.number().int().nullish(),
  salaryPeriod: z.enum(["year", "month", "day", "hour"]).nullish(),
  salaryRaw: z.string().nullish(),
  experienceRequiredMonths: z.number().int().nullish(),
  experienceLabel: z.string().nullish(),
  workContext: z.record(z.string(), z.unknown()).nullish(),
  appellationLibelle: z.string().nullish(),
  romeCode: z.string().nullish(),
  dateActualisation: z.date().nullish(),
  accessibleTH: z.boolean().nullish(),
  entrepriseAdaptee: z.boolean().nullish(),
  employeurHandiEngage: z.boolean().nullish(),
  nombrePostes: z.number().int().nullish(),
});

export type NormalizedPosting = z.infer<typeof NormalizedPostingSchema>;

export type ConnectorKind =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workday"
  | "france-travail"
  | "hn"
  | "remoteok";

/**
 * A connector takes its config and returns normalized postings.
 * Connectors must NOT touch the DB — that's the repository's job.
 */
export interface SourceConnector<TConfig = unknown> {
  kind: ConnectorKind;
  fetch(config: TConfig): Promise<NormalizedPosting[]>;
}

// Connector-specific configs

export const GreenhouseConfigSchema = z
  .object({
    board: z.string().min(1), // e.g. "airbnb" → boards-api.greenhouse.io/v1/boards/airbnb/jobs
  })
  .extend(IngestFilterSchema.shape);
export type GreenhouseConfig = z.infer<typeof GreenhouseConfigSchema>;

export const LeverConfigSchema = z
  .object({
    site: z.string().min(1), // e.g. "vercel" → api.lever.co/v0/postings/vercel
    team: z.string().optional(),
    department: z.string().optional(),
    location: z.string().optional(),
    commitment: z.string().optional(),
  })
  .extend(IngestFilterSchema.shape);
export type LeverConfig = z.infer<typeof LeverConfigSchema>;

export const FranceTravailConfigSchema = z
  .object({
    motsCles: z.string().optional(), // keywords
    codeROME: z.string().optional(), // e.g. "M1805" for Études et développement informatique
    commune: z.string().optional(),
    departement: z.string().optional(),
    region: z.string().optional(),
    typeContrat: z.string().optional(), // CDI, CDD, MIS, SAI
    teletravail: z.boolean().optional(),
    publieeDepuis: z.number().int().min(1).max(31).optional(),
    maxResults: z.number().int().min(1).max(150).default(50),
  })
  .extend(IngestFilterSchema.shape);
export type FranceTravailConfig = z.infer<typeof FranceTravailConfigSchema>;

export const HnConfigSchema = z
  .object({
    query: z.string().optional(),
    monthsBack: z.number().int().min(1).max(12).default(3),
  })
  .extend(IngestFilterSchema.shape);
export type HnConfig = z.infer<typeof HnConfigSchema>;
