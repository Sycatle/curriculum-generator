"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function DeleteSourceButton({ sourceId, label }: { sourceId: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(`Supprimer la source « ${label} » et toutes ses offres ?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/sources/${encodeURIComponent(sourceId)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "Suppression impossible");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || isPending}
      className="rounded-md border px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
    >
      {busy || isPending ? "…" : "supprimer"}
    </button>
  );
}
