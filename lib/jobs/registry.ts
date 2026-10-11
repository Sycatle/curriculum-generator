/**
 * Connector registry — maps source kind → connector + config parser.
 *
 * Add a new ATS by appending an entry here. Everything else (pipeline,
 * repository, UI) is generic.
 */

import { z } from "zod";
import type { ConnectorKind, NormalizedPosting, SourceConnector } from "./schema";
import {
  FranceTravailConfigSchema,
  GreenhouseConfigSchema,
  HnConfigSchema,
  LeverConfigSchema,
} from "./schema";
import { greenhouseConnector } from "./sources/greenhouse";
import { leverConnector } from "./sources/lever";
import { franceTravailConnector } from "./sources/france-travail";
import { hnConnector } from "./sources/hn-algolia";

interface RegistryEntry {
  connector: SourceConnector<unknown>;
  configSchema: z.ZodTypeAny;
}

const REGISTRY: Partial<Record<ConnectorKind, RegistryEntry>> = {
  greenhouse: { connector: greenhouseConnector as SourceConnector<unknown>, configSchema: GreenhouseConfigSchema },
  lever: { connector: leverConnector as SourceConnector<unknown>, configSchema: LeverConfigSchema },
  "france-travail": {
    connector: franceTravailConnector as SourceConnector<unknown>,
    configSchema: FranceTravailConfigSchema,
  },
  hn: { connector: hnConnector as SourceConnector<unknown>, configSchema: HnConfigSchema },
};

export function getConnector(kind: ConnectorKind): RegistryEntry {
  const entry = REGISTRY[kind];
  if (!entry) {
    throw new Error(`No connector registered for kind '${kind}'`);
  }
  return entry;
}

export async function fetchSource(kind: ConnectorKind, rawConfig: unknown): Promise<NormalizedPosting[]> {
  const { connector, configSchema } = getConnector(kind);
  const config = configSchema.parse(rawConfig);
  return connector.fetch(config);
}
