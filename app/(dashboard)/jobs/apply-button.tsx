"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ApplyButton({
  postingId,
  cvId,
}: {
  postingId: string;
  cvId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    if (!cvId) {
      setMsg("Choisis un CV en haut");
      return;
    }
    if (!confirm("Envoyer cette candidature ?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(postingId)}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvId }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean; candidateId?: unknown };
      if (!res.ok) {
        setMsg(data.error ?? "Erreur");
        return;
      }
      setMsg("Envoyé ✓");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-[10px] text-[var(--color-muted)]">{msg}</span> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={busy || isPending}
        title={cvId ? "Apply via Greenhouse API" : "Choisis un CV pour activer"}
        className="rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-border)]/30 disabled:opacity-50"
      >
        {busy || isPending ? "apply…" : "apply"}
      </button>
    </div>
  );
}
