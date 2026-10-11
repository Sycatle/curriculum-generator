import { z } from "zod";
import type { CompanySourceConnector, CompanySourceKind, NormalizedCompany } from "./schema";
import { RechercheEntreprisesConfigSchema } from "./schema";
import { rechercheEntreprisesConnector } from "./sources/recherche-entreprises";
import { apifyGmapsConnector, ApifyGmapsConfigSchema } from "./sources/apify-gmaps";

interface RegistryEntry {
  connector: CompanySourceConnector<unknown>;
  configSchema: z.ZodTypeAny;
}

const REGISTRY: Partial<Record<CompanySourceKind, RegistryEntry>> = {
  "recherche-entreprises": {
    connector: rechercheEntreprisesConnector as CompanySourceConnector<unknown>,
    configSchema: RechercheEntreprisesConfigSchema,
  },
  "apify-gmaps": {
    connector: apifyGmapsConnector as CompanySourceConnector<unknown>,
    configSchema: ApifyGmapsConfigSchema,
  },
};

export function getCompanyConnector(kind: CompanySourceKind): RegistryEntry {
  const entry = REGISTRY[kind];
  if (!entry) throw new Error(`No company connector for kind '${kind}'`);
  return entry;
}

export async function fetchCompaniesFromSource(
  kind: CompanySourceKind,
  rawConfig: unknown,
): Promise<NormalizedCompany[]> {
  const { connector, configSchema } = getCompanyConnector(kind);
  const config = configSchema.parse(rawConfig);
  return connector.fetch(config);
}
