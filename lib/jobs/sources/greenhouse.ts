/**
 * Greenhouse Job Board API connector.
 *
 * GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true
 *
 * Public, no auth. JSON-clean. Covers a huge share of US/EU scale-ups.
 */

import type { GreenhouseConfig, NormalizedPosting, SourceConnector } from "../schema";
import { applyIngestFilter } from "./ingest-filter";

interface GreenhouseJob {
  id: number;
  internal_job_id: number;
  title: string;
  absolute_url: string;
  location: { name: string } | null;
  content: string; // HTML
  updated_at: string;
  departments: { id: number; name: string }[];
  offices: { id: number; name: string; location?: string | null }[];
  metadata: unknown;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

const REMOTE_RE = /\b(remote|anywhere|distributed|work from home)\b/i;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export const greenhouseConnector: SourceConnector<GreenhouseConfig> = {
  kind: "greenhouse",
  async fetch(config) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(config.board)}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Greenhouse ${config.board}: HTTP ${res.status}`);
    }
    const data = (await res.json()) as GreenhouseResponse;

    const postings = data.jobs.map<NormalizedPosting>((job) => {
      const html = job.content ?? "";
      const text = stripHtml(html);
      const locationName = job.location?.name ?? null;
      const remote = REMOTE_RE.test(locationName ?? "") || REMOTE_RE.test(text.slice(0, 500));
      const department = job.departments[0]?.name ?? null;

      return {
        externalId: String(job.id),
        url: job.absolute_url,
        title: job.title,
        company: config.board,
        location: locationName,
        remote,
        employmentType: null,
        department,
        descriptionHtml: html,
        descriptionText: text,
        postedAt: job.updated_at ? new Date(job.updated_at) : null,
        raw: job as unknown as Record<string, unknown>,
      };
    });
    return applyIngestFilter(postings, config);
  },
};
