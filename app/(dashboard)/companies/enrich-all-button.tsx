"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface BatchResponse {
  processed?: number;
  summary?: Array<{ inserted: number; lang: string | null }>;
  error?: string;
}

export function EnrichAllButton({ limit = 25 }: { limit?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/companies/enrich-all?limit=${limit}`, { method: "POST" });
      const data = (await res.json()) as BatchResponse;
      if (!res.ok) {
        setMsg(data.error ?? "Erreur");
        return;
      }
      const totalInserted = data.summary?.reduce((s, x) => s + x.inserted, 0) ?? 0;
      setMsg(`${data.processed ?? 0} entreprises · ${totalInserted} contacts ajoutés`);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-xs text-[var(--color-muted)]">{msg}</span> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={busy || isPending}
        className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--color-border)]/30 disabled:opacity-50"
      >
        {busy || isPending ? `Enrichissement (${limit})…` : `Enrichir (${limit})`}
      </button>
    </div>
  );
}
