"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface MailboxState {
  fromAddress: string;
  sentToday: number;
  capacity: number;
  available: boolean;
}

interface BatchRow {
  contactId: string;
  email: string;
  status: string;
  reason?: string;
}

interface BatchSummary {
  attempted?: number;
  sent?: number;
  skipped?: number;
  failed?: number;
  capReached?: boolean;
  rows?: BatchRow[];
  error?: string;
}

export function BatchPanel({
  cvs,
  mailboxes,
  resendConfigured,
}: {
  cvs: { id: string; title: string }[];
  mailboxes: MailboxState[];
  resendConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [limit, setLimit] = useState(5);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<BatchSummary | null>(null);

  async function onRun() {
    if (!cvId) return;
    setBusy(true);
    setSummary(null);
    try {
      const res = await fetch("/api/outreach/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvId, limit, onlyVerified, dryRun }),
      });
      const data = (await res.json()) as BatchSummary;
      setSummary(data);
      if (!dryRun && (data.sent ?? 0) > 0) startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border p-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-muted)]">
        Batch runner
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs uppercase text-[var(--color-muted)]">CV</label>
          <select
            value={cvId}
            onChange={(e) => setCvId(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            {cvs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase text-[var(--color-muted)]">
            Limit (par run)
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyVerified}
              onChange={(e) => setOnlyVerified(e.target.checked)}
            />
            Contacts vérifiés uniquement
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry-run (aperçu, pas d&apos;envoi)
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRun}
          disabled={busy || isPending || !cvId || (!dryRun && !resendConfigured)}
          className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Run…" : dryRun ? "Run dry" : "Run & envoyer"}
        </button>
        {!resendConfigured ? (
          <span className="text-xs text-rose-700">
            Resend non configuré — l&apos;envoi est désactivé.
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase text-[var(--color-muted)]">
            Mailboxes (24h)
          </h3>
          {mailboxes.length === 0 ? (
            <p className="text-xs text-rose-700">
              Aucune mailbox configurée (OUTREACH_FROM_ADDRESS ou OUTREACH_FROM_ADDRESSES).
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {mailboxes.map((m) => (
                <li key={m.fromAddress} className="flex justify-between font-mono">
                  <span className={m.available ? "" : "text-rose-700"}>{m.fromAddress}</span>
                  <span>
                    {m.sentToday}/{m.capacity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase text-[var(--color-muted)]">
            Dernier run
          </h3>
          {summary ? (
            summary.error ? (
              <p className="text-xs text-rose-700">{summary.error}</p>
            ) : (
              <>
                <p className="text-xs">
                  attempted {summary.attempted ?? 0} · sent {summary.sent ?? 0} · skipped{" "}
                  {summary.skipped ?? 0} · failed {summary.failed ?? 0}
                  {summary.capReached ? " · cap-reached" : ""}
                </p>
                {summary.rows?.length ? (
                  <ul className="mt-1 max-h-32 overflow-y-auto text-[11px]">
                    {summary.rows.map((r) => (
                      <li key={r.contactId} className="font-mono">
                        {r.status} · {r.email}
                        {r.reason ? ` — ${r.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )
          ) : (
            <p className="text-xs text-[var(--color-muted)]">Aucun run encore.</p>
          )}
        </div>
      </div>
    </section>
  );
}
