/**
 * Common-pattern enricher.
 *
 * Always available — generates the standard B2B "front-desk" addresses from
 * the company domain. These are NOT verified; mark them as `verified=false`.
 * Useful baseline before any paid enrichment: most small companies do reply
 * to `hello@` or `careers@`, and bounce rates are usually < 10 %.
 *
 * Priority for cold outreach: `careers@` > `jobs@` > `talent@` > `hello@` > `contact@`.
 */

import type { ContactEnricher, NormalizedContact } from "./schema";

const COMMON_LOCALS = [
  { local: "careers", title: "Careers inbox" },
  { local: "jobs", title: "Jobs inbox" },
  { local: "talent", title: "Talent inbox" },
  { local: "recrutement", title: "Recrutement" },
  { local: "rh", title: "RH" },
  { local: "hello", title: "General inbox" },
  { local: "contact", title: "General contact" },
];

export const commonPatternEnricher: ContactEnricher = {
  name: "common-pattern",
  available() {
    return true;
  },
  async enrich(input) {
    if (!input.domain) return [];
    const domain = input.domain.toLowerCase().replace(/^www\./, "");
    const contacts: NormalizedContact[] = [];
    for (const { local, title } of COMMON_LOCALS) {
      contacts.push({
        email: `${local}@${domain}`,
        emailKind: "generic",
        firstName: null,
        lastName: null,
        title,
        source: "common-pattern",
        verified: false,
      });
    }
    return contacts;
  },
};
