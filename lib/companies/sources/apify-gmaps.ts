/**
 * Apify Google Maps connector.
 *
 * Uses Apify's "compass/crawler-google-places" actor (5k free results/month
 * on the starter plan, then ~$0.016 / result). Sync API: POST run-sync-get-dataset-items
 * returns dataset rows in the same request — perfect for short batches.
 *
 * Env: APIFY_TOKEN.
 *
 * Use this for cities outside France where INSEE doesn't help (London, Berlin,
 * Amsterdam, Barcelona, Lisbon, Dublin, Stockholm, NYC, SF...).
 *
 * The actor accepts:
 *   - `locationQuery`: free-text location (e.g. "London, UK", "Berlin, Germany")
 *   - `searchStringsArray`: keywords (e.g. ["software company", "AI startup"])
 *   - `maxCrawledPlacesPerSearch`: per-keyword cap
 */

import type {
  CompanySourceConnector,
  NormalizedCompany,
} from "../schema";
import { z } from "zod";

export const ApifyGmapsConfigSchema = z.object({
  locationQuery: z.string().min(1), // e.g. "London, UK"
  searchStringsArray: z.array(z.string().min(1)).min(1).max(10),
  /** Per-keyword cap. Keep it modest to control cost. */
  maxCrawledPlacesPerSearch: z.number().int().min(1).max(200).default(40),
  /** ISO 2-letter country code (e.g. "GB", "DE", "US") — used to tag the result. */
  countryCode: z.string().length(2).optional(),
  /** Optional language hint for the actor's UI scraping. */
  language: z.string().optional(),
});
export type ApifyGmapsConfig = z.infer<typeof ApifyGmapsConfigSchema>;

interface ApifyPlace {
  placeId?: string;
  cid?: string;
  title?: string;
  subTitle?: string | null;
  description?: string | null;
  categoryName?: string;
  categories?: string[];
  website?: string;
  url?: string; // Google Maps URL
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  state?: string;
  totalScore?: number;
  reviewsCount?: number;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
}

function extractDomain(website: string | undefined): string | null {
  if (!website) return null;
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export const apifyGmapsConnector: CompanySourceConnector<ApifyGmapsConfig> = {
  kind: "apify-gmaps",
  async fetch(config) {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      throw new Error("APIFY_TOKEN is not set");
    }

    const url = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const body = {
      locationQuery: config.locationQuery,
      searchStringsArray: config.searchStringsArray,
      maxCrawledPlacesPerSearch: config.maxCrawledPlacesPerSearch ?? 40,
      language: config.language ?? "en",
      // Strip what we don't need to save bandwidth.
      scrapeReviewsPersonalData: false,
      scrapeContacts: true,
      maxReviews: 0,
      maxImages: 0,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Apify gmaps: HTTP ${res.status} — ${txt.slice(0, 200)}`);
    }
    const items = (await res.json()) as ApifyPlace[];

    const out: NormalizedCompany[] = [];
    for (const item of items) {
      if (item.permanentlyClosed || item.temporarilyClosed) continue;
      const externalId = item.placeId ?? item.cid ?? item.url;
      if (!externalId) continue;
      const domain = extractDomain(item.website);
      const country = item.countryCode?.toUpperCase() ?? config.countryCode?.toUpperCase() ?? null;
      out.push({
        externalId,
        source: "apify-gmaps",
        name: item.title ?? "—",
        domain,
        country,
        city: item.city ?? null,
        postalCode: item.postalCode ?? null,
        activityCode: null,
        activityLabel: item.categoryName ?? item.categories?.[0] ?? null,
        headcount: null,
        headcountMin: null,
        headcountMax: null,
        raw: item as unknown as Record<string, unknown>,
      });
    }
    return out;
  },
};
