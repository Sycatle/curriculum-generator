/**
 * Suggested sources — bootstraps a new user's dashboard with public
 * connectors that don't require any credentials. Idempotent: re-running
 * skips IDs that already exist (handy when the user re-clicks the button).
 */

import { createSource, getSource, type JobSourceRecord } from "./repository";
import type { ConnectorKind } from "./schema";

export interface SuggestedSource {
  id: string;
  kind: ConnectorKind;
  label: string;
  config: Record<string, unknown>;
}

export const SUGGESTED_SOURCES: ReadonlyArray<SuggestedSource> = [
  {
    id: "greenhouse:vercel",
    kind: "greenhouse",
    label: "Vercel (Greenhouse)",
    config: { board: "vercel" },
  },
  {
    id: "lever:netflix",
    kind: "lever",
    label: "Netflix (Lever)",
    config: { site: "netflix" },
  },
  {
    id: "hn:whoishiring",
    kind: "hn",
    label: "Hacker News — Who's Hiring",
    config: { monthsBack: 3 },
  },
];

export interface SeedResult {
  created: JobSourceRecord[];
  skipped: string[];
}

export async function seedSuggestedSources(userId: string): Promise<SeedResult> {
  const created: JobSourceRecord[] = [];
  const skipped: string[] = [];

  for (const s of SUGGESTED_SOURCES) {
    const existing = await getSource(s.id, userId);
    if (existing) {
      skipped.push(s.id);
      continue;
    }
    try {
      const row = await createSource({
        id: s.id,
        userId,
        kind: s.kind,
        label: s.label,
        config: s.config,
      });
      created.push(row);
    } catch {
      skipped.push(s.id);
    }
  }

  return { created, skipped };
}
