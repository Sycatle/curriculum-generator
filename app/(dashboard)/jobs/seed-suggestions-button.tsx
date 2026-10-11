"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SeedSuggestionsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/jobs/sources/seed", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        created?: { id: string }[];
        skipped?: string[];
        refresh?: { ok: number; failed: number; inserted: number };
      };
      if (!res.ok) {
        setMsg(data.error ?? "Erreur");
        return;
      }
      const created = data.created?.length ?? 0;
      const inserted = data.refresh?.inserted ?? 0;
      setMsg(`${created} sources créées · ${inserted} offres importées`);
      startTransition(() => router.refresh());
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || isPending}
        className="rounded-md bg-[var(--color-fg)] px-3 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
      >
        {busy || isPending ? "Import en cours…" : "Importer 3 sources publiques pour commencer"}
      </button>
      {msg ? <p className="text-xs text-[var(--color-muted)]">{msg}</p> : null}
    </div>
  );
}
