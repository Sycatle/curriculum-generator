"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export interface KanbanCard {
  id: string;
  status: string;
  subject: string;
  lang: string;
  sentAt: string | null;
  createdAt: string;
  contactEmail: string;
  contactName: string | null;
  companyName: string;
  companyDomain: string | null;
  companyId: string;
}

/**
 * Funnel columns (in order). We collapse some "edge" statuses into the
 * earlier funnel stage: queued+failed → "Queued/Issue", bounced/complained/
 * unsubscribed → "Excluded".
 */
const COLUMNS: { key: string; label: string; statuses: string[]; tone: string }[] = [
  {
    key: "queued",
    label: "Queued / Issue",
    statuses: ["queued", "failed"],
    tone: "border-slate-300",
  },
  { key: "sent", label: "Sent", statuses: ["sent"], tone: "border-blue-300" },
  { key: "replied", label: "Replied", statuses: ["replied"], tone: "border-violet-300" },
  { key: "interview", label: "Interview", statuses: ["interview"], tone: "border-amber-300" },
  { key: "hired", label: "Hired", statuses: ["hired"], tone: "border-emerald-300" },
  { key: "lost", label: "Lost", statuses: ["lost"], tone: "border-rose-300" },
  {
    key: "excluded",
    label: "Excluded",
    statuses: ["bounced", "complained", "unsubscribed"],
    tone: "border-zinc-300",
  },
];

const MANUAL_NEXT: Record<string, { label: string; status: string }[]> = {
  sent: [
    { label: "→ Replied", status: "replied" },
    { label: "→ Lost", status: "lost" },
  ],
  replied: [
    { label: "→ Interview", status: "interview" },
    { label: "→ Lost", status: "lost" },
  ],
  interview: [
    { label: "→ Hired", status: "hired" },
    { label: "→ Lost", status: "lost" },
  ],
};

function CardView({
  card,
  onTransition,
  busy,
}: {
  card: KanbanCard;
  onTransition: (newStatus: string) => void;
  busy: boolean;
}) {
  const actions = MANUAL_NEXT[card.status];
  return (
    <div className="rounded-md border bg-[var(--color-bg)] p-2 text-xs">
      <Link href={`/companies/${card.companyId}`} className="block font-medium hover:underline">
        {card.companyName}
      </Link>
      <div className="text-[10px] text-[var(--color-muted)]">
        {card.contactName ? `${card.contactName} · ` : ""}
        <span className="font-mono">{card.contactEmail}</span>
      </div>
      <div className="mt-1 line-clamp-2 italic text-[var(--color-muted)]">{card.subject}</div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
        <span>{card.sentAt ? card.sentAt.slice(0, 10) : card.createdAt.slice(0, 10)}</span>
        <span className="rounded-full border px-1.5 py-0.5 uppercase">{card.lang}</span>
      </div>
      {actions && actions.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {actions.map((a) => (
            <button
              key={a.status}
              type="button"
              onClick={() => onTransition(a.status)}
              disabled={busy}
              className="rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-[var(--color-border)]/30 disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Kanban({ cards: initial }: { cards: KanbanCard[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const c of cards) {
      const col = COLUMNS.find((x) => x.statuses.includes(c.status));
      if (col) map.get(col.key)!.push(c);
    }
    return map;
  }, [cards]);

  async function transition(card: KanbanCard, newStatus: string) {
    setBusy(card.id);
    try {
      const res = await fetch(
        `/api/outreach/messages/${encodeURIComponent(card.id)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (res.ok) {
        // Optimistic update — replace the card in state, no full refresh.
        setCards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, status: newStatus } : c)),
        );
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  if (cards.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-6 text-sm text-[var(--color-muted)]">
        Aucun message envoyé pour l&apos;instant. Lance un batch ou un envoi unitaire depuis une fiche
        entreprise.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-7">
      {COLUMNS.map((col) => {
        const items = byColumn.get(col.key) ?? [];
        return (
          <section key={col.key} className={`rounded-md border-2 ${col.tone} bg-transparent p-2`}>
            <h3 className="mb-2 flex items-baseline justify-between text-xs font-medium uppercase">
              {col.label}
              <span className="text-[10px] text-[var(--color-muted)]">{items.length}</span>
            </h3>
            <div className="space-y-2">
              {items.map((c) => (
                <CardView
                  key={c.id}
                  card={c}
                  busy={busy === c.id || isPending}
                  onTransition={(s) => transition(c, s)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
