/**
 * Shared ingest-time filter for source connectors.
 *
 * Each connector merges `IngestFilterSchema` into its config and calls
 * `applyIngestFilter` on the normalized postings before returning them.
 * The goal is to drop irrelevant postings *before* they hit the DB, so
 * the user's `/jobs` view stays focused without rescoring everything.
 */

import { z } from "zod";
import type { NormalizedPosting } from "../schema";

export const IngestFilterSchema = z.object({
  /** Case-insensitive regex applied to the title; keep only matching postings. */
  titleIncludeRegex: z.string().optional(),
  /** Case-insensitive regex applied to the title; drop matching postings. */
  titleExcludeRegex: z.string().optional(),
  /** Drop postings whose `remote` flag is false. */
  remoteOnly: z.boolean().optional(),
  /**
   * If non-empty, keep only postings whose `title + descriptionText` contains
   * at least one of these substrings (case-insensitive). Crucial for HN.
   */
  requireStackKeywords: z.array(z.string()).optional(),
});

export type IngestFilter = z.infer<typeof IngestFilterSchema>;

function safeRegex(pattern: string | undefined): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

export function applyIngestFilter<T extends NormalizedPosting>(
  postings: T[],
  filter: IngestFilter | undefined,
): T[] {
  if (!filter) return postings;
  const includeRx = safeRegex(filter.titleIncludeRegex);
  const excludeRx = safeRegex(filter.titleExcludeRegex);
  const stack = (filter.requireStackKeywords ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  return postings.filter((p) => {
    if (filter.remoteOnly && !p.remote) return false;
    if (includeRx && !includeRx.test(p.title)) return false;
    if (excludeRx && excludeRx.test(p.title)) return false;
    if (stack.length > 0) {
      const hay = `${p.title} ${p.descriptionText ?? ""}`.toLowerCase();
      const hit = stack.some((s) => hay.includes(s));
      if (!hit) return false;
    }
    return true;
  });
}
