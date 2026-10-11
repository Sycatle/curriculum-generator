"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/jobs/sources/${encodeURIComponent(sourceId)}/refresh`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; fetched?: number; inserted?: number; updated?: number };
      if (!res.ok) {
        setMsg(data.error ?? "Erreur");
      } else {
        setMsg(`${data.fetched ?? 0} offres (${data.inserted ?? 0} nouvelles, ${data.updated ?? 0} màj)`);
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg ? <span className="text-xs text-[var(--color-muted)]">{msg}</span> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={busy || isPending}
        className="rounded-md border px-2.5 py-1 text-xs hover:bg-[var(--color-border)]/30 disabled:opacity-50"
      >
        {busy || isPending ? "sync…" : "sync"}
      </button>
    </div>
  );
}
