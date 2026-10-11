import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rechercheEntreprisesConnector } from "@/lib/companies/sources/recherche-entreprises";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("recherche-entreprises connector", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              siren: "552120222",
              nom_complet: "ACME SAS",
              nom_raison_sociale: "ACME",
              activite_principale: "62.01Z",
              section_activite_principale: "J",
              tranche_effectif_salarie: "12",
              etat_administratif: "A",
              siege: {
                siret: "55212022200012",
                libelle_commune: "PARIS",
                code_postal: "75008",
                departement: "75",
              },
              complements: { site_web: "https://acme.example" },
            },
            {
              siren: "999000111",
              nom_complet: "ZEN AI",
              activite_principale: "62.09Z",
              tranche_effectif_salarie: "11",
              etat_administratif: "A",
              siege: { libelle_commune: "LYON", code_postal: "69002" },
            },
          ],
          total_results: 2,
          page: 1,
          total_pages: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  it("normalizes results into NormalizedCompany shape", async () => {
    const out = await rechercheEntreprisesConnector.fetch({
      activitePrincipale: "62.01Z",
      perPage: 25,
      maxPages: 1,
      etatAdministratif: "A",
    });
    expect(out).toHaveLength(2);

    const acme = out[0]!;
    expect(acme.externalId).toBe("552120222");
    expect(acme.name).toBe("ACME SAS");
    expect(acme.domain).toBe("acme.example");
    expect(acme.country).toBe("FR");
    expect(acme.city).toBe("PARIS");
    expect(acme.postalCode).toBe("75008");
    expect(acme.activityCode).toBe("62.01Z");
    expect(acme.headcountMin).toBe(20);
    expect(acme.headcountMax).toBe(49);

    const zen = out[1]!;
    expect(zen.domain).toBeNull();
    expect(zen.headcountMin).toBe(10);
  });

  it("stops paginating when total_pages is reached", async () => {
    const out = await rechercheEntreprisesConnector.fetch({
      activitePrincipale: "62.01Z",
      perPage: 25,
      maxPages: 5,
      etatAdministratif: "A",
    });
    expect(out).toHaveLength(2);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
