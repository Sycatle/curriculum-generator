"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface CvOption {
  id: string;
  title: string;
}

interface ContactOption {
  id: string;
  email: string;
  verified: boolean;
  unsubscribed: boolean;
  bounced: boolean;
  complained: boolean;
}

interface PreviewResult {
  status?: string;
  reason?: string;
  subject?: string;
  bodyMarkdown?: string;
  to?: string;
  from?: string;
  lang?: string;
  resendId?: string;
  error?: string;
}

export function OutreachPanel({
  cvs,
  contacts,
  defaultLang,
  resendConfigured,
}: {
  cvs: CvOption[];
  contacts: ContactOption[];
  defaultLang: "fr" | "en";
  resendConfigured: boolean;
}) {
  const router = useRouter();
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [contactId, setContactId] = useState(
    contacts.find((c) => !c.unsubscribed && !c.bounced && !c.complained)?.id ?? "",
  );
  const [lang, setLang] = useState<"fr" | "en">(defaultLang);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPreview() {
    if (!cvId || !contactId) return;
    setBusy(true);
    setPreview(null);
    try {
      const res = await fetch("/api/outreach/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvId, contactId, lang }),
      });
      const data = (await res.json()) as PreviewResult;
      setPreview(data);
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!cvId || !contactId || !resendConfigured) return;
    setBusy(true);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvId, contactId, lang }),
      });
      const data = (await res.json()) as PreviewResult;
      setPreview(data);
      if (data.status === "sent") router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (contacts.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-6 text-sm text-[var(--color-muted)]">
        Lance d&apos;abord l&apos;enrichissement pour obtenir des contacts.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted)]">
            CV
          </label>
          <select
            value={cvId}
            onChange={(e) => setCvId(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5"
          >
            {cvs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted)]">
            Destinataire
          </label>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5"
          >
            {contacts.map((c) => {
              const flags = [
                c.verified ? "✓" : "",
                c.unsubscribed ? "unsub" : "",
                c.bounced ? "bounce" : "",
                c.complained ? "spam" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <option
                  key={c.id}
                  value={c.id}
                  disabled={c.unsubscribed || c.bounced || c.complained}
                >
                  {c.email} {flags ? `· ${flags}` : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs uppercase text-[var(--color-muted)]">Langue</span>
        {(["fr", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`rounded-md border px-2 py-1 text-xs ${
              lang === l ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : ""
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={busy || !cvId || !contactId}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-border)]/30 disabled:opacity-50"
          >
            {busy ? "…" : "Aperçu (sans envoi)"}
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={busy || !cvId || !contactId || !resendConfigured}
            title={resendConfigured ? "" : "RESEND_API_KEY + OUTREACH_FROM_ADDRESS requis"}
            className="rounded-md bg-[var(--color-fg)] px-3 py-1.5 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-md border bg-[var(--color-border)]/10 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-muted)]">
            <span>
              {preview.status}
              {preview.lang ? ` · ${preview.lang}` : ""}
              {preview.to ? ` · → ${preview.to}` : ""}
              {preview.from ? ` · de ${preview.from}` : ""}
              {preview.resendId ? ` · resend:${preview.resendId.slice(0, 8)}` : ""}
            </span>
            {preview.reason ? <span className="italic">{preview.reason}</span> : null}
          </div>
          {preview.error ? (
            <p className="text-rose-700">{preview.error}</p>
          ) : preview.subject ? (
            <>
              <div className="mb-2 font-semibold">{preview.subject}</div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {preview.bodyMarkdown}
              </pre>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
