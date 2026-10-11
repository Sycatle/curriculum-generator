"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface RefreshAllResponse {
  total: number;
  ok: number;
  failed: number;
  inserted: number;
  updated: number;
  fetched: number;
  errors?: { sourceId: string; error?: string }[];
}

export function SyncAllButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/jobs/sources/refresh-all", { method: "POST" });
      const data = (await res.json()) as RefreshAllResponse & { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Erreur");
        return;
      }
      setMsg(
        `${data.ok}/${data.total} sources · ${data.inserted} nouvelles${data.failed ? ` · ${data.failed} erreurs` : ""}`,
      );
      startTransition(() => router.refresh());
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
        disabled={disabled || busy || isPending}
        className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--color-border)]/30 disabled:opacity-50"
      >
        {busy || isPending ? "Sync en cours…" : "Sync all"}
      </button>
    </div>
  );
}
