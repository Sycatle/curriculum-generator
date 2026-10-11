import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/server";
import { db, schema } from "@/lib/db/client";
import { listCvsForUser } from "@/lib/cv/repository";
import { listPostingsForUser, listSources } from "@/lib/jobs/repository";
import { getTargetingProfile } from "@/lib/jobs/targeting";
import { AutoRefresh } from "./auto-refresh";
import { DeleteSourceButton } from "./delete-source-button";
import { MatchControls } from "./match-controls";
import { PostingsList } from "./postings-list";
import { RefreshButton } from "./refresh-button";
import { SeedSuggestionsButton } from "./seed-suggestions-button";
import { SyncAllButton } from "./sync-all-button";

const PAGE_SIZE = 50;

export const metadata = { title: "Offres" };
export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days}j`;
  return d.toISOString().slice(0, 10);
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    remote?: string;
    source?: string;
    cvId?: string;
    sort?: string;
    minFit?: string;
    showExcluded?: string;
    showAlternance?: string;
    showMismatch?: string;
  }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const sort = sp.sort === "fit" ? "fit" : "discovered";
  const profile = await getTargetingProfile(session.user.id);
  // When a targeting profile exists, default to minFit=50 unless the user
  // explicitly overrode it (incl. setting minFit=0).
  const defaultMinFit = profile ? 50 : 0;
  const minFit = sp.minFit !== undefined ? Number(sp.minFit) : defaultMinFit;
  const hideExcluded = sp.showExcluded !== "1";
  const hideAlternance = !!profile?.excludeAlternance && sp.showAlternance !== "1";
  const hideMismatch = !!profile && sp.showMismatch !== "1";
  const [sources, cvs, postings] = await Promise.all([
    listSources(session.user.id),
    listCvsForUser(session.user.id),
    listPostingsForUser(session.user.id, {
      query: sp.q,
      remote: sp.remote === "1" ? true : undefined,
      sourceId: sp.source,
      sort,
      minFit: minFit > 0 ? minFit : undefined,
      hideExcluded,
      hideAlternance,
      hideLlmMismatch: hideMismatch,
      limit: PAGE_SIZE,
    }),
  ]);

  const postingSourceIds = Array.from(new Set(postings.map((p) => p.sourceId)));
  const [postingSources, existingApps] = await Promise.all([
    postingSourceIds.length
      ? db
          .select({ id: schema.jobSource.id, kind: schema.jobSource.kind })
          .from(schema.jobSource)
          .where(inArray(schema.jobSource.id, postingSourceIds))
      : Promise.resolve([] as { id: string; kind: string }[]),
    postings.length
      ? db
          .select({
            postingId: schema.jobApplication.postingId,
            status: schema.jobApplication.status,
          })
          .from(schema.jobApplication)
          .where(eq(schema.jobApplication.userId, session.user.id))
      : Promise.resolve([] as { postingId: string; status: string }[]),
  ]);

  const sourceKindById = Object.fromEntries(postingSources.map((s) => [s.id, s.kind]));
  const applicationByPostingId = Object.fromEntries(
    existingApps.map((a) => [a.postingId, a.status]),
  );

  const filterParams = {
    q: sp.q,
    remote: sp.remote,
    source: sp.source,
    cvId: sp.cvId,
    sort: sort === "fit" ? "fit" : undefined,
    minFit: sp.minFit,
    showExcluded: sp.showExcluded,
    showAlternance: sp.showAlternance,
    showMismatch: sp.showMismatch,
  };
  const filterKey = JSON.stringify(filterParams);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Offres</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Sources connectées : Greenhouse, Lever, France Travail, Hacker News.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/jobs/targeting"
            className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--color-border)]/30"
            title="Définit ce que tu cherches"
          >
            {profile ? "Profil ✓" : "Profil de ciblage"}
          </Link>
          {sources.length > 0 ? <SyncAllButton /> : null}
          <Link
            href="/jobs/new"
            className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90"
          >
            Ajouter une source
          </Link>
        </div>
      </div>
      {sources.length > 0 ? <AutoRefresh /> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Sources ({sources.length})
        </h2>
        {sources.length === 0 ? (
          <div className="space-y-3 rounded-md border border-dashed px-4 py-6 text-sm text-[var(--color-muted)]">
            <p>
              Aucune source. Importe les suggestions publiques en un clic, ou ajoute la tienne.
            </p>
            <SeedSuggestionsButton />
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    <span className="font-mono">{s.kind}</span> · {s.id}
                    {s.lastPolledAt ? ` · sync ${fmtDate(s.lastPolledAt)}` : " · jamais sync"}
                    {s.lastError ? ` · erreur : ${s.lastError}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshButton sourceId={s.id} />
                  <DeleteSourceButton sourceId={s.id} label={s.label} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Offres
          </h2>
          <MatchControls
            cvs={cvs.map((c) => ({ id: c.id, title: c.title }))}
            activeCvId={sp.cvId ?? null}
            activeSort={sort}
            activeMinFit={sp.minFit !== undefined ? minFit : null}
          />
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm" action="" method="get">
          {sp.cvId ? <input type="hidden" name="cvId" value={sp.cvId} /> : null}
          {sort === "fit" ? <input type="hidden" name="sort" value="fit" /> : null}
          {sp.minFit !== undefined ? (
            <input type="hidden" name="minFit" value={sp.minFit} />
          ) : null}
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="filtrer (titre, entreprise, description)"
            className="w-72 rounded-md border px-2 py-1"
          />
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              name="remote"
              value="1"
              defaultChecked={sp.remote === "1"}
            />
            remote
          </label>
          {profile ? (
            <>
              <label className="flex items-center gap-1 text-xs" title="Cache les offres rejetées par ton profil">
                <input
                  type="checkbox"
                  name="showExcluded"
                  value="1"
                  defaultChecked={sp.showExcluded === "1"}
                />
                afficher exclues
              </label>
              {profile.excludeAlternance ? (
                <label className="flex items-center gap-1 text-xs" title="Cache les offres en alternance/apprentissage">
                  <input
                    type="checkbox"
                    name="showAlternance"
                    value="1"
                    defaultChecked={sp.showAlternance === "1"}
                  />
                  afficher alternance
                </label>
              ) : null}
              <label className="flex items-center gap-1 text-xs" title="Cache les offres jugées mismatch par l'IA">
                <input
                  type="checkbox"
                  name="showMismatch"
                  value="1"
                  defaultChecked={sp.showMismatch === "1"}
                />
                afficher mismatch IA
              </label>
            </>
          ) : null}
          <button type="submit" className="rounded-md border px-2 py-1 text-xs">
            filtrer
          </button>
          {profile ? (
            <span className="text-[10px] text-[var(--color-muted)]">
              minFit par défaut : {defaultMinFit} (profil actif)
            </span>
          ) : null}
        </form>
        <PostingsList
          key={filterKey}
          initial={{
            postings,
            sourceKindById,
            applicationByPostingId,
            hasMore: postings.length === PAGE_SIZE,
          }}
          pageSize={PAGE_SIZE}
          filterParams={filterParams}
          fallbackCvId={cvs[0]?.id ?? null}
        />
      </section>
    </div>
  );
}
