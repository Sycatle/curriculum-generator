"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MinusCircle, Target, XCircle } from "lucide-react";
import type { CvData } from "@/lib/cv/schema";
import { extractJobKeywords, matchKeywords, type KeywordMatch } from "@/lib/cv/job-match";

type Props = {
  data: CvData;
};

const STATUS_ICON: Record<KeywordMatch["status"], typeof CheckCircle2> = {
  present: CheckCircle2,
  weak: MinusCircle,
  missing: XCircle,
};

const STATUS_COLOR: Record<KeywordMatch["status"], string> = {
  present: "text-emerald-600 dark:text-emerald-400",
  weak: "text-amber-600 dark:text-amber-400",
  missing: "text-red-500",
};

export function JobMatchPanel({ data }: Props) {
  const [jd, setJd] = useState("");
  const result = useMemo(() => {
    if (jd.trim().length < 50) return null;
    const keywords = extractJobKeywords(jd);
    return matchKeywords(data, keywords);
  }, [jd, data]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4" />
          Match avec une fiche de poste
        </div>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Colle ici la fiche de poste (titre, missions, requirements…)"
          rows={6}
          className="mt-2 w-full rounded-md border bg-transparent p-2 text-xs outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        {result && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="rounded-full border px-2 py-0.5 font-semibold">
              {result.coverage}% must-have
            </span>
            <span className="text-[var(--color-muted)]">
              {result.matches.filter((m) => m.status === "present").length}/{result.keywords.length} keywords présents
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!result ? (
          <p className="text-xs text-[var(--color-muted)]">
            Colle une fiche de poste (≥ 50 caractères) pour voir le diff des mots-clés.
          </p>
        ) : (
          <div className="space-y-3">
            <KeywordBucket
              title="À combler en priorité"
              matches={result.matches.filter(
                (m) => m.status === "missing" && m.keyword.category === "must-have",
              )}
            />
            <KeywordBucket
              title="Présents mais faibles"
              matches={result.matches.filter((m) => m.status === "weak")}
            />
            <KeywordBucket
              title="Présents"
              matches={result.matches.filter((m) => m.status === "present")}
              dim
            />
            <KeywordBucket
              title="Optionnels manquants"
              matches={result.matches.filter(
                (m) => m.status === "missing" && m.keyword.category !== "must-have",
              )}
              dim
            />
          </div>
        )}
      </div>
    </div>
  );
}

function KeywordBucket({
  title,
  matches,
  dim,
}: {
  title: string;
  matches: KeywordMatch[];
  dim?: boolean;
}) {
  if (matches.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title} ({matches.length})
      </h3>
      <div className={`flex flex-wrap gap-1 ${dim ? "opacity-60" : ""}`}>
        {matches.map((m, i) => {
          const Icon = STATUS_ICON[m.status];
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              title={
                m.foundIn.length
                  ? `Trouvé dans : ${m.foundIn.join(", ")}`
                  : "Absent du CV"
              }
            >
              <Icon className={`h-3 w-3 ${STATUS_COLOR[m.status]}`} />
              <span>{m.keyword.term}</span>
              {m.keyword.category === "must-have" && (
                <span className="text-[9px] uppercase text-[var(--color-muted)]">req</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
