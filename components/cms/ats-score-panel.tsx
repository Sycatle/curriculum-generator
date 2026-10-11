"use client";

import { useMemo } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { CvData } from "@/lib/cv/schema";
import { computeAtsScore, scoreBand, type Issue, type Severity } from "@/lib/cv/ats-checks";

type Props = {
  data: CvData;
  /** Appelé quand un issue est cliqué. La cible reçoit le path JSON (ex: "header.email"). */
  onJumpTo?: (path: string) => void;
};

const SEVERITY_ICON: Record<Severity, typeof Info> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR: Record<Severity, string> = {
  error: "text-red-500",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
};

export function AtsScorePanel({ data, onJumpTo }: Props) {
  const result = useMemo(() => computeAtsScore(data), [data]);
  const band = scoreBand(result.score);

  const ring =
    band === "high"
      ? "stroke-emerald-500"
      : band === "mid"
        ? "stroke-amber-500"
        : "stroke-red-500";
  const label =
    band === "high" ? "ATS-friendly" : band === "mid" ? "À renforcer" : "À retravailler";

  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (c * result.score) / 100;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle
              cx="36"
              cy="36"
              r={r}
              fill="none"
              className="stroke-[var(--color-border)]"
              strokeWidth="6"
            />
            <circle
              cx="36"
              cy="36"
              r={r}
              fill="none"
              className={ring}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </svg>
          <div>
            <div className="text-2xl font-semibold leading-tight">{result.score}</div>
            <div className="text-xs text-[var(--color-muted)]">{label}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Bucket label="Structure" value={result.buckets.structure} />
          <Bucket label="Contenu" value={result.buckets.content} />
          <Bucket label="Format" value={result.buckets.formatting} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {result.issues.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Aucun problème détecté.
          </div>
        ) : (
          <ul className="space-y-1">
            {result.issues.map((issue, i) => (
              <IssueRow key={i} issue={issue} onJumpTo={onJumpTo} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  const color =
    value >= 85
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  onJumpTo,
}: {
  issue: Issue;
  onJumpTo?: (path: string) => void;
}) {
  const Icon = SEVERITY_ICON[issue.severity];
  const clickable = Boolean(issue.path && onJumpTo);
  return (
    <li>
      <button
        type="button"
        onClick={() => issue.path && onJumpTo?.(issue.path)}
        disabled={!clickable}
        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
          clickable ? "hover:bg-[var(--color-border)]/40" : "cursor-default"
        }`}
      >
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${SEVERITY_COLOR[issue.severity]}`} />
        <span className="flex-1">{issue.message}</span>
        {issue.impact > 0 && (
          <span className="shrink-0 text-[10px] text-[var(--color-muted)]">−{issue.impact}</span>
        )}
      </button>
    </li>
  );
}
