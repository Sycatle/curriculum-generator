/**
 * SUGGESTED_SOURCES must validate against the connector registry's config
 * schemas — otherwise the seed button creates broken sources that fail at
 * fetch time.
 */

import { describe, expect, it } from "vitest";

import { getConnector } from "@/lib/jobs/registry";
import { SUGGESTED_SOURCES } from "@/lib/jobs/seed";

describe("SUGGESTED_SOURCES", () => {
  it("each suggestion has a unique id", () => {
    const ids = SUGGESTED_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each suggestion's config parses against its connector schema", () => {
    for (const s of SUGGESTED_SOURCES) {
      const { configSchema } = getConnector(s.kind);
      const result = configSchema.safeParse(s.config);
      expect(result.success, `${s.id} config invalid: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it("does not seed connectors that require credentials", () => {
    // France Travail needs FRANCE_TRAVAIL_CLIENT_ID/SECRET. We must not seed it
    // by default, otherwise self-hosters without those env vars see broken
    // sources out of the box.
    const kinds = SUGGESTED_SOURCES.map((s) => s.kind);
    expect(kinds).not.toContain("france-travail");
  });
});
