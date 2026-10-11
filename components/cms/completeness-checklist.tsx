"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import type { CvData } from "@/lib/cv/schema";
import { LIMITS } from "@/lib/cv/limits";

type Props = {
  data: CvData;
};

type Item = {
  label: string;
  ok: boolean;
};

function buildItems(data: CvData): Item[] {
  const items: Item[] = [];

  items.push({ label: "Email présent", ok: Boolean(data.header.email) });
  items.push({
    label: "Résumé professionnel 2–3 phrases",
    ok:
      Boolean(data.summary) &&
      data.summary!.length >= 60 &&
      data.summary!.length <= LIMITS.summaryChars.hard,
  });
  items.push({
    label: "≥ 2 expériences",
    ok: data.experiences.length >= 2,
  });
  items.push({
    label: "Au moins 1 chiffre par bullet (≥ 70%)",
    ok:
      data.experiences.length > 0 &&
      (() => {
        const all = data.experiences.flatMap((e) => e.bullets);
        if (all.length === 0) return false;
        const withMetric = all.filter((b) =>
          /\d{2,}|\d+%|\d+x|~\s*\d+/.test(b),
        ).length;
        return withMetric / all.length >= 0.7;
      })(),
  });
  items.push({
    label: "Lien GitHub / portfolio / LinkedIn",
    ok: data.header.links.some((l) =>
      /github|gitlab|linkedin|portfolio|behance|dribbble/i.test(l.href),
    ),
  });
  items.push({ label: "Pas de photo", ok: !data.photoUrl });
  items.push({
    label: "≥ 3 catégories de compétences",
    ok: data.skills.length >= 3,
  });
  items.push({
    label: "≤ 16 compétences au total",
    ok: data.skills.reduce((a, g) => a + g.items.length, 0) <= 16,
  });
  items.push({
    label: "Formation renseignée",
    ok: data.education.length > 0,
  });
  items.push({
    label: "≤ 10 expériences (les vieilles disparaissent)",
    ok: data.experiences.length <= 10,
  });

  return items;
}

export function CompletenessChecklist({ data }: Props) {
  const items = useMemo(() => buildItems(data), [data]);
  const passed = items.filter((i) => i.ok).length;
  const total = items.length;
  const pct = Math.round((passed / total) * 100);

  return (
    <div className="rounded-md border bg-[var(--color-bg)] p-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">Definition of done</span>
        <span className="text-[var(--color-muted)]">
          {passed}/{total} · {pct}%
        </span>
      </div>
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className={`h-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {it.ok ? (
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <X className="h-3 w-3 text-red-500" />
            )}
            <span className={it.ok ? "text-[var(--color-muted)] line-through" : ""}>
              {it.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
