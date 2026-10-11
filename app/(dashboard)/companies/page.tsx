import Link from "next/link";
import { requireSession } from "@/lib/auth/server";
import { listCompaniesForUser } from "@/lib/companies/repository";
import { EnrichAllButton } from "./enrich-all-button";

export const metadata = { title: "Entreprises" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    activity?: string;
    city?: string;
    minHeadcount?: string;
    maxHeadcount?: string;
  }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const companies = await listCompaniesForUser(session.user.id, {
    query: sp.q,
    activityCode: sp.activity,
    city: sp.city,
    minHeadcount: sp.minHeadcount ? Number(sp.minHeadcount) : undefined,
    maxHeadcount: sp.maxHeadcount ? Number(sp.maxHeadcount) : undefined,
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Entreprises</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Découverte via recherche-entreprises.api.gouv.fr (FR). Apify Google Maps EU/US à venir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnrichAllButton />
          <Link
            href="/companies/discover"
            className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90"
          >
            Découvrir
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2 text-sm" action="" method="get">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="nom / domaine"
          className="w-56 rounded-md border px-2 py-1"
        />
        <input
          type="text"
          name="activity"
          defaultValue={sp.activity ?? ""}
          placeholder="NAF (ex 62.01Z)"
          className="w-32 rounded-md border px-2 py-1 font-mono"
        />
        <input
          type="text"
          name="city"
          defaultValue={sp.city ?? ""}
          placeholder="ville"
          className="w-32 rounded-md border px-2 py-1"
        />
        <input
          type="number"
          name="minHeadcount"
          defaultValue={sp.minHeadcount ?? ""}
          placeholder="min effectif"
          className="w-24 rounded-md border px-2 py-1"
        />
        <input
          type="number"
          name="maxHeadcount"
          defaultValue={sp.maxHeadcount ?? ""}
          placeholder="max effectif"
          className="w-24 rounded-md border px-2 py-1"
        />
        <button type="submit" className="rounded-md border px-2 py-1 text-xs">
          filtrer
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-muted)]">
          {companies.length} entreprise{companies.length > 1 ? "s" : ""}
        </h2>
        {companies.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-6 text-sm text-[var(--color-muted)]">
            Aucune entreprise. Clique sur « Découvrir » pour lancer une recherche.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {companies.map((c) => (
              <li key={c.id} className="px-4 py-3 hover:bg-[var(--color-border)]/20">
                <Link href={`/companies/${c.id}`} className="block">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">{c.name}</span>
                        {c.domain ? (
                          <span className="text-xs text-[var(--color-muted)]">{c.domain}</span>
                        ) : null}
                        {c.websiteLang ? (
                          <span className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase">
                            {c.websiteLang}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {c.activityCode ? (
                          <span className="font-mono">{c.activityCode}</span>
                        ) : null}
                        {c.city ? ` · ${c.city}${c.postalCode ? ` (${c.postalCode})` : ""}` : ""}
                        {c.headcount ? ` · ${c.headcount}` : ""}
                        {c.country ? ` · ${c.country}` : ""}
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--color-muted)]">{c.discoveredFrom}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
