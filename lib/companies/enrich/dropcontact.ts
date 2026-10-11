/**
 * Dropcontact enricher.
 *
 * - GDPR-audited (CNIL), real-time email generation, no scraped DB.
 * - Strongest coverage on FR (~94 %), decent on EU.
 * - Async batch API: POST /batch → request_id, poll GET /batch/<id> until ready.
 *
 * Env: DROPCONTACT_API_KEY (header X-Access-Token).
 *
 * For now we hit the synchronous-friendly endpoint and poll up to 30s. If the
 * job isn't done in time, we throw — caller can retry.
 */

import type { ContactEnricher, NormalizedContact } from "./schema";

interface DropcontactBatchResponseInitial {
  success: boolean;
  request_id?: string;
  error?: string;
}

interface DropcontactResult {
  email?: { email: string; qualification: string }[];
  first_name?: string;
  last_name?: string;
  full_name?: string;
  civility?: string;
  company?: string;
  website?: string;
  job?: string;
}

interface DropcontactBatchResponseFinal {
  success: boolean;
  data?: DropcontactResult[];
  reason?: string;
  error?: string;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 45_000;

async function postBatch(apiKey: string, body: object): Promise<DropcontactBatchResponseInitial> {
  const res = await fetch("https://api.dropcontact.io/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Access-Token": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Dropcontact POST /batch: HTTP ${res.status}`);
  }
  return (await res.json()) as DropcontactBatchResponseInitial;
}

async function pollBatch(apiKey: string, requestId: string): Promise<DropcontactBatchResponseFinal> {
  const deadline = Date.now() + MAX_POLL_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`https://api.dropcontact.io/batch/${requestId}`, {
      headers: { "X-Access-Token": apiKey },
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`Dropcontact poll: HTTP ${res.status}`);
    const data = (await res.json()) as DropcontactBatchResponseFinal & { success: boolean };
    if (data.success && data.data) return data;
    // success=false typically means "still processing"
  }
  throw new Error("Dropcontact batch timed out");
}

export const dropcontactEnricher: ContactEnricher = {
  name: "dropcontact",
  available() {
    return !!process.env.DROPCONTACT_API_KEY;
  },
  async enrich(input) {
    const apiKey = process.env.DROPCONTACT_API_KEY;
    if (!apiKey) return [];

    // Dropcontact requires at least one of: website, num (siren/siret), or full_name+company.
    // For company-level enrichment we send website + siren.
    const row: Record<string, string> = {};
    if (input.domain) row.website = input.domain;
    if (input.siren) row.num = input.siren;
    row.company = input.companyName;
    if (!row.website && !row.num) return [];

    const initial = await postBatch(apiKey, {
      data: [row],
      siren: false,
      language: "fr",
    });
    if (!initial.success || !initial.request_id) {
      throw new Error(initial.error ?? "Dropcontact rejected the request");
    }

    const final = await pollBatch(apiKey, initial.request_id);
    const rows = final.data ?? [];

    const contacts: NormalizedContact[] = [];
    for (const r of rows) {
      const emails = r.email ?? [];
      for (const e of emails) {
        // qualification: 'correct' | 'incorrect' | 'pro' — keep correct/pro only
        if (e.qualification && /incorrect|invalid/i.test(e.qualification)) continue;
        contacts.push({
          email: e.email,
          emailKind: r.first_name || r.last_name ? "nominative" : "generic",
          firstName: r.first_name ?? null,
          lastName: r.last_name ?? null,
          title: r.job ?? null,
          source: "dropcontact",
          verified: true,
        });
      }
    }
    return contacts;
  },
};
