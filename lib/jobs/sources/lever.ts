/**
 * Lever postings API connector.
 *
 * GET https://api.lever.co/v0/postings/{site}?mode=json
 *
 * Supports filtering via `team`, `department`, `location`, `commitment`.
 */

import type { LeverConfig, NormalizedPosting, SourceConnector } from "../schema";
import { applyIngestFilter } from "./ingest-filter";

interface LeverPosting {
  id: string;
  text: string; // title
  hostedUrl: string;
  applyUrl: string;
  categories: {
    team?: string;
    department?: string;
    location?: string;
    commitment?: string;
    allLocations?: string[];
  };
  descriptionPlain?: string;
  description?: string; // HTML
  lists?: { text: string; content: string }[];
  createdAt?: number; // epoch ms
}

const REMOTE_RE = /\b(remote|anywhere|distributed|work from home)\b/i;

export const leverConnector: SourceConnector<LeverConfig> = {
  kind: "lever",
  async fetch(config) {
    const params = new URLSearchParams({ mode: "json" });
    if (config.team) params.set("team", config.team);
    if (config.department) params.set("department", config.department);
    if (config.location) params.set("location", config.location);
    if (config.commitment) params.set("commitment", config.commitment);

    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(config.site)}?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Lever ${config.site}: HTTP ${res.status}`);
    }
    const postings = (await res.json()) as LeverPosting[];

    const mapped = postings.map<NormalizedPosting>((p) => {
      const location = p.categories.location ?? p.categories.allLocations?.[0] ?? null;
      const remote = REMOTE_RE.test(location ?? "") || (p.categories.allLocations ?? []).some((l) => REMOTE_RE.test(l));

      return {
        externalId: p.id,
        url: p.hostedUrl,
        title: p.text,
        company: config.site,
        location,
        remote,
        employmentType: p.categories.commitment ?? null,
        department: p.categories.department ?? p.categories.team ?? null,
        descriptionHtml: p.description ?? null,
        descriptionText: p.descriptionPlain ?? null,
        postedAt: p.createdAt ? new Date(p.createdAt) : null,
        raw: p as unknown as Record<string, unknown>,
      };
    });
    return applyIngestFilter(mapped, config);
  },
};
