import { describe, expect, it } from "vitest";
import { commonPatternEnricher } from "@/lib/companies/enrich/common-pattern";
import { dropcontactEnricher } from "@/lib/companies/enrich/dropcontact";

describe("commonPatternEnricher", () => {
  it("returns the standard B2B addresses for a domain", async () => {
    const out = await commonPatternEnricher.enrich({
      domain: "acme.com",
      companyName: "ACME",
    });
    expect(out.length).toBeGreaterThan(3);
    expect(out.every((c) => c.email.endsWith("@acme.com"))).toBe(true);
    expect(out.every((c) => c.verified === false)).toBe(true);
    expect(out.every((c) => c.source === "common-pattern")).toBe(true);
    expect(out.every((c) => c.emailKind === "generic")).toBe(true);
    // careers should come first (priority)
    expect(out[0]!.email).toBe("careers@acme.com");
  });

  it("returns nothing for a company without a domain", async () => {
    const out = await commonPatternEnricher.enrich({ domain: null, companyName: "Unknown" });
    expect(out).toEqual([]);
  });

  it("strips www. and lower-cases the domain", async () => {
    const out = await commonPatternEnricher.enrich({
      domain: "WWW.Acme.COM",
      companyName: "ACME",
    });
    expect(out[0]!.email).toBe("careers@acme.com");
  });
});

describe("dropcontactEnricher", () => {
  it("is not available without an API key", () => {
    const orig = process.env.DROPCONTACT_API_KEY;
    delete process.env.DROPCONTACT_API_KEY;
    expect(dropcontactEnricher.available()).toBe(false);
    if (orig) process.env.DROPCONTACT_API_KEY = orig;
  });
});
