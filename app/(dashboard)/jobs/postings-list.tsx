"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobPostingRecord } from "@/lib/jobs/repository";
import { ApplyButton } from "./apply-button";
import { FitBadge } from "./match-controls";

interface ApiResponse {
  postings: JobPostingRecord[];
  sourceKindById: Record<string, string>;
  applicationByPostingId: Record<string, string>;
  hasMore: boolean;
}

interface Props {
  initial: ApiResponse;
  pageSize: number;
  /** Query string params to forward (q, remote, source, sort, minFit, showExcluded, cvId). */
  filterParams: Record<string, string | undefined>;
  fallbackCvId: string | null;
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days}j`;
  return date.toISOString().slice(0, 10);
}

function fmtSalary(p: JobPostingRecord): string | null {
  if (p.salaryMinEUR == null && p.salaryMaxEUR == null) return null;
  const unit =
    p.salaryPeriod === "year"
      ? "/an"
      : p.salaryPeriod === "month"
        ? "/mois"
        : p.salaryPeriod === "day"
          ? "/jour"
          : p.salaryPeriod === "hour"
            ? "/h"
            : "";
  const fmt = (n: number) => {
    if (p.salaryPeriod === "year" && n >= 1000) return `${Math.round(n / 1000)}k€`;
    return `${n.toLocaleString("fr-FR")} €`;
  };
  if (p.salaryMinEUR != null && p.salaryMaxEUR != null && p.salaryMinEUR !== p.salaryMaxEUR) {
    return `${fmt(p.salaryMinEUR)}–${fmt(p.salaryMaxEUR)}${unit}`;
  }
  return `${fmt((p.salaryMinEUR ?? p.salaryMaxEUR)!)}${unit}`;
}

export function PostingsList({ initial, pageSize, filterParams, fallbackCvId }: Props) {
  const [postings, setPostings] = useState<JobPostingRecord[]>(initial.postings);
  const [sourceKindById, setSourceKindById] = useState<Record<string, string>>(
    initial.sourceKindById,
  );
  const [appByPostingId, setAppByPostingId] = useState<Record<string, string>>(
    initial.applicationByPostingId,
  );
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset whenever filters change (the parent re-mounts via key prop, but be safe).
  const filterKey = useMemo(() => JSON.stringify(filterParams), [filterParams]);
  useEffect(() => {
    setPostings(initial.postings);
    setSourceKindById(initial.sourceKindById);
    setAppByPostingId(initial.applicationByPostingId);
    setHasMore(initial.hasMore);
    setError(null);
  }, [filterKey, initial]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("offset", String(postings.length));
      params.set("limit", String(pageSize));
      for (const [k, v] of Object.entries(filterParams)) {
        if (v) params.set(k, v);
      }
      const res = await fetch(`/api/jobs/postings?${params.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Erreur de chargement");
        return;
      }
      const data = (await res.json()) as ApiResponse;
      setPostings((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.postings.filter((p) => !seen.has(p.id))];
      });
      setSourceKindById((prev) => ({ ...prev, ...data.sourceKindById }));
      setAppByPostingId((prev) => ({ ...prev, ...data.applicationByPostingId }));
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [filterParams, hasMore, loading, pageSize, postings.length]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "400px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  if (postings.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-6 text-sm text-[var(--color-muted)]">
        Aucune offre. Clique sur « sync » sur une source.
      </p>
    );
  }

  const cvIdForApply = filterParams.cvId ?? fallbackCvId;

  return (
    <>
      <ul className="divide-y rounded-md border">
        {postings.map((p) => {
          const sourceKind = sourceKindById[p.sourceId];
          const appStatus = appByPostingId[p.id];
          const canApply = sourceKind === "greenhouse" && !appStatus;
          return (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-center gap-2">
                  <FitBadge
                    score={p.fitScore}
                    breakdown={
                      p.fitScoreBreakdown as Parameters<typeof FitBadge>[0]["breakdown"]
                    }
                  />
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:underline"
                  >
                    {p.title}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  {appStatus ? (
                    <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase">
                      {appStatus}
                    </span>
                  ) : canApply ? (
                    <ApplyButton postingId={p.id} cvId={cvIdForApply} />
                  ) : null}
                  <span className="text-xs text-[var(--color-muted)]">{fmtDate(p.postedAt)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--color-muted)]">
                <span className="font-medium text-[var(--color-fg)]">{p.company}</span>
                {p.location ? <span>· {p.location}</span> : null}
                {p.remote ? <span>· remote</span> : null}
                {p.department ? <span>· {p.department}</span> : null}
                {p.employmentType ? <span>· {p.employmentType}</span> : null}
                {p.isAlternance ? (
                  <span className="rounded border border-amber-300 bg-amber-50 px-1 py-0 text-[10px] text-amber-900">
                    alternance
                  </span>
                ) : null}
                {(() => {
                  const s = fmtSalary(p);
                  return s ? (
                    <span className="rounded border px-1 py-0 text-[10px]">{s}</span>
                  ) : null;
                })()}
                {p.experienceLabel ? <span>· exp. {p.experienceLabel}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div ref={sentinelRef} className="h-1" />
      {loading ? (
        <p className="py-3 text-center text-xs text-[var(--color-muted)]">Chargement…</p>
      ) : null}
      {error ? <p className="py-3 text-center text-xs text-red-600">{error}</p> : null}
      {!hasMore && postings.length > 0 ? (
        <p className="py-3 text-center text-xs text-[var(--color-muted)]">
          Toutes les offres affichées ({postings.length})
        </p>
      ) : null}
    </>
  );
}
