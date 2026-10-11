"use client";

import type { CvData } from "@/lib/cv/schema";

type Change = {
  path: string;
  before: string;
  after: string;
};

function summarize(value: unknown): string {
  if (value == null) return "(empty)";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("company" in obj && "role" in obj) return `${obj.role} @ ${obj.company}`;
    if ("category" in obj) return String(obj.category);
    if ("name" in obj) return String(obj.name);
    return JSON.stringify(value).slice(0, 80);
  }
  return String(value);
}

function diffArrays<T>(
  a: T[],
  b: T[],
  prefix: string,
  changes: Change[],
) {
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const before = a[i];
    const after = b[i];
    if (before === undefined && after !== undefined) {
      changes.push({ path: `${prefix}[${i}]`, before: "—", after: summarize(after) });
    } else if (before !== undefined && after === undefined) {
      changes.push({ path: `${prefix}[${i}]`, before: summarize(before), after: "—" });
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ path: `${prefix}[${i}]`, before: summarize(before), after: summarize(after) });
    }
  }
}

export function computeDiff(before: CvData, after: CvData): Change[] {
  const changes: Change[] = [];
  for (const k of Object.keys(before.header) as (keyof CvData["header"])[]) {
    if (before.header[k] !== after.header[k]) {
      changes.push({
        path: `header.${String(k)}`,
        before: summarize(before.header[k]),
        after: summarize(after.header[k]),
      });
    }
  }
  if (before.summary !== after.summary) {
    changes.push({
      path: "summary",
      before: summarize(before.summary),
      after: summarize(after.summary),
    });
  }
  diffArrays(before.experiences, after.experiences, "experiences", changes);
  diffArrays(before.projects, after.projects, "projects", changes);
  diffArrays(before.education, after.education, "education", changes);
  diffArrays(before.skills, after.skills, "skills", changes);
  diffArrays(before.languages, after.languages, "languages", changes);
  return changes;
}

export function CvDiffPreview({
  before,
  after,
}: {
  before: CvData;
  after: CvData;
}) {
  const changes = computeDiff(before, after);
  if (changes.length === 0) {
    return <p className="text-xs text-[var(--color-muted)]">No changes detected.</p>;
  }
  return (
    <ul className="space-y-2 text-xs">
      {changes.map((c, i) => (
        <li key={i} className="rounded-md border p-2">
          <p className="font-mono text-[10px] uppercase text-[var(--color-muted)]">
            {c.path}
          </p>
          <p className="mt-1 line-through opacity-60">{c.before}</p>
          <p className="text-[var(--color-accent)]">{c.after}</p>
        </li>
      ))}
    </ul>
  );
}
