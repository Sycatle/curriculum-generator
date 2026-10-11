"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function MatchControls({
  cvs,
  activeCvId,
  activeSort,
  activeMinFit,
}: {
  cvs: { id: string; title: string }[];
  activeCvId: string | null;
  activeSort: "discovered" | "fit";
  activeMinFit: number | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function pushWith(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.push(`/jobs?${next.toString()}`));
  }

  async function matchAll() {
    if (!activeCvId) {
      setMsg("Choisis d'abord un CV");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/jobs/match-all?cvId=${encodeURIComponent(activeCvId)}`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; scored?: number; total?: number };
      if (!res.ok) {
        setMsg(data.error ?? "Erreur");
      } else {
        setMsg(`${data.scored}/${data.total} scorées`);
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        value={activeCvId ?? ""}
        onChange={(e) => pushWith({ cvId: e.target.value || null })}
        className="rounded-md border px-2 py-1"
      >
        <option value="">— CV —</option>
        {cvs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <select
        value={activeSort}
        onChange={(e) => pushWith({ sort: e.target.value === "fit" ? "fit" : null })}
        className="rounded-md border px-2 py-1 text-xs"
      >
        <option value="discovered">Tri: date</option>
        <option value="fit">Tri: fit score</option>
      </select>
      <label className="flex items-center gap-1 text-xs">
        Min fit
        <input
          type="number"
          min={0}
          max={100}
          defaultValue={activeMinFit ?? ""}
          onBlur={(e) => pushWith({ minFit: e.target.value || null })}
          className="w-14 rounded-md border px-2 py-1"
        />
      </label>
      <button
        type="button"
        onClick={matchAll}
        disabled={busy || isPending || !activeCvId}
        className="rounded-md border px-2.5 py-1 text-xs hover:bg-[var(--color-border)]/30 disabled:opacity-50"
      >
        {busy ? "scoring…" : "match all"}
      </button>
      {msg ? <span className="text-xs text-[var(--color-muted)]">{msg}</span> : null}
    </div>
  );
}

type BreakdownShape = {
  total?: number;
  finalTotal?: number;
  excluded?: boolean;
  excludeReasons?: string[];
  parts?: {
    keywords?: number;
    location?: number;
    remote?: number;
    seniority?: number;
    language?: number;
    employment?: number;
    role?: number;
  };
  llm?: {
    verdict?: "fit" | "stretch" | "mismatch";
    score?: number;
    reasons?: string[];
  } | null;
};

function formatBreakdown(b: BreakdownShape | null | undefined): string {
  if (!b) return "Pas encore scoré";
  if (b.excluded) return `Exclu : ${(b.excludeReasons ?? []).join(" · ")}`;
  const p = b.parts ?? {};
  const parts = [
    `keywords ${p.keywords ?? 0}/40`,
    `loc ${p.location ?? 0}/20`,
    `remote ${p.remote ?? 0}/10`,
    `senior ${p.seniority ?? 0}/10`,
    `lang ${p.language ?? 0}/10`,
    `contract ${p.employment ?? 0}/5`,
    `role ${p.role ?? 0}/5`,
  ];
  let s = parts.join(" · ");
  if (b.llm) {
    s += `\n— IA ${b.llm.verdict ?? "?"} (${b.llm.score ?? 0}/100)`;
    if (b.llm.reasons && b.llm.reasons.length > 0) {
      s += "\n  · " + b.llm.reasons.join("\n  · ");
    }
  }
  return s;
}

export function FitBadge({
  score,
  breakdown,
}: {
  score: number | null;
  breakdown?: BreakdownShape | null;
}) {
  if (score === null && !breakdown) {
    return (
      <span
        className="rounded border px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
        title="Pas encore scoré"
      >
        —
      </span>
    );
  }
  if (breakdown?.excluded) {
    return (
      <span
        className="rounded border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-900 whitespace-pre-line"
        title={formatBreakdown(breakdown)}
      >
        exclu
      </span>
    );
  }
  const displayScore = score ?? breakdown?.total ?? 0;
  const tone =
    displayScore >= 70
      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
      : displayScore >= 40
        ? "bg-amber-100 text-amber-900 border-amber-300"
        : "bg-rose-100 text-rose-900 border-rose-300";
  const verdict = breakdown?.llm?.verdict;
  const verdictDot =
    verdict === "fit"
      ? "bg-emerald-500"
      : verdict === "stretch"
        ? "bg-amber-500"
        : verdict === "mismatch"
          ? "bg-rose-500"
          : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone} whitespace-pre-line`}
      title={formatBreakdown(breakdown)}
    >
      {verdictDot ? <span className={`h-1.5 w-1.5 rounded-full ${verdictDot}`} aria-hidden /> : null}
      {displayScore}
    </span>
  );
}
