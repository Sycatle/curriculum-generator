"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface EnrichResponse {
  langDetected?: string | null;
  contactsByEnricher?: Record<string, number>;
  upsert?: { inserted: number; updated: number };
  notes?: string[];
  error?: string;
}

export function EnrichButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(companyId)}/enrich`, {
        method: "POST",
      });
      const data = (await res.json()) as EnrichResponse;
      if (!res.ok) {
        setMsg(data.error ?? "Erreur");
        return;
      }
      const enrichers = Object.entries(data.contactsByEnricher ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join(", ");
      const inserted = data.upsert?.inserted ?? 0;
      const updated = data.upsert?.updated ?? 0;
      setMsg(
        `${inserted} nouveau(x), ${updated} màj · lang ${data.langDetected ?? "?"} · ${enrichers}`,
      );
      startTransition(() => router.refresh());
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
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-border)]/30 disabled:opacity-50"
      >
        {busy || isPending ? "Enrichissement…" : "Enrichir"}
      </button>
    </div>
  );
}
