/**
 * Normalized contact shape — every enricher must produce this.
 */

import { z } from "zod";

export const NormalizedContactSchema = z.object({
  email: z.string().email(),
  emailKind: z.enum(["generic", "nominative"]),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  title: z.string().nullish(),
  source: z.string().min(1), // 'dropcontact' | 'hunter' | 'common-pattern' | 'manual'
  verified: z.boolean(),
});

export type NormalizedContact = z.infer<typeof NormalizedContactSchema>;

export interface ContactEnricher {
  name: string;
  available(): boolean;
  enrich(input: { domain: string | null; companyName: string; siren?: string | null }): Promise<NormalizedContact[]>;
}
