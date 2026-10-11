/**
 * Enrichment pipeline — for a given company:
 *   1. Detect website language (cached on `company.website_lang`).
 *   2. Run available enrichers (Dropcontact if key set, else common-pattern).
 *   3. Upsert into `contact` table.
 *
 * The pipeline is intentionally synchronous (no queue) for now — caller
 * (API route or batch worker) is responsible for rate-limiting.
 */

import type { CompanyRecord } from "../repository";
import { setCompanyDomain, updateCompanyLang } from "../repository";
import { upsertContacts, type UpsertContactsResult } from "../contact-repository";
import { detectWebsiteLang } from "../lang-detect";
import { commonPatternEnricher } from "./common-pattern";
import { dropcontactEnricher } from "./dropcontact";
import type { ContactEnricher, NormalizedContact } from "./schema";

const ENRICHERS: ContactEnricher[] = [dropcontactEnricher, commonPatternEnricher];

export interface EnrichResult {
  langDetected: "fr" | "en" | "both" | null;
  contactsByEnricher: Record<string, number>;
  upsert: UpsertContactsResult;
  notes: string[];
}

/**
 * Best-effort domain guess for FR companies whose website isn't in the
 * recherche-entreprises payload: try `{slug}.fr` and `{slug}.com`.
 *
 * NOTE: we don't HTTP-check it here; lang-detect will, and if it can't
 * fetch the homepage, the company stays without a domain.
 */
function guessDomain(companyName: string): string | null {
  const slug = companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
  if (!slug || slug.length < 3) return null;
  return `${slug}.fr`;
}

export async function enrichCompany(company: CompanyRecord): Promise<EnrichResult> {
  const notes: string[] = [];
  let domain = company.domain;

  if (!domain) {
    const guess = guessDomain(company.name);
    if (guess) {
      domain = guess;
      notes.push(`Domain guessed: ${guess} (unverified)`);
    }
  }

  // 1. Language detection (best-effort)
  let langDetected: "fr" | "en" | "both" | null = company.websiteLang as
    | "fr"
    | "en"
    | "both"
    | null;
  if (domain && !langDetected) {
    try {
      langDetected = await detectWebsiteLang(domain);
      if (langDetected) {
        await updateCompanyLang(company.id, langDetected);
        // If we successfully reached the homepage and the company didn't
        // have a stored domain, persist the guessed one.
        if (!company.domain) await setCompanyDomain(company.id, domain);
      } else {
        // Domain didn't resolve / homepage unreadable. For FR companies
        // default to fr (most likely), so downstream message generation
        // has a sensible default.
        if (company.country === "FR") {
          langDetected = "fr";
          notes.push("Lang fallback: fr (FR company, homepage unreachable)");
        }
      }
    } catch (err) {
      notes.push(`Lang detect failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // 2. Enrichers (skip the ones not available)
  const siren = company.discoveredFrom === "recherche-entreprises" ? company.externalId : null;
  const collected: NormalizedContact[] = [];
  const byEnricher: Record<string, number> = {};

  for (const enricher of ENRICHERS) {
    if (!enricher.available()) continue;
    try {
      const found = await enricher.enrich({
        domain: domain ?? null,
        companyName: company.name,
        siren,
      });
      byEnricher[enricher.name] = found.length;
      collected.push(...found);
    } catch (err) {
      notes.push(`${enricher.name} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // 3. Dedup by email (case-insensitive), prefer verified=true
  const map = new Map<string, NormalizedContact>();
  for (const c of collected) {
    const key = c.email.toLowerCase();
    const existing = map.get(key);
    if (!existing || (!existing.verified && c.verified)) {
      map.set(key, c);
    }
  }
  const upsert = await upsertContacts(company.id, [...map.values()]);

  return { langDetected, contactsByEnricher: byEnricher, upsert, notes };
}
