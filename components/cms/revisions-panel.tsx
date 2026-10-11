"use client";

import { useEffect, useState, useTransition } from "react";
import { History, RotateCcw, X } from "lucide-react";
import type { CvInput } from "@/lib/cv/schema";
import {
  listRevisionsAction,
  restoreRevisionAction,
} from "@/app/(dashboard)/cvs/actions";

type Revision = { id: string; createdAt: string };

type Props = {
  cvId: string;
  onRestore: (next: CvInput, updatedAt: string) => void;
  currentSnapshot: CvInput;
};

export function RevisionsPanel({ cvId, onRestore, currentSnapshot }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listRevisionsAction(cvId)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [open, cvId]);

  function restore(revisionId: string) {
    setRestoring(revisionId);
    startTransition(async () => {
      const res = await restoreRevisionAction(cvId, revisionId);
      setRestoring(null);
      if (res.ok) {
        onRestore({ ...currentSnapshot, data: res.data, theme: res.theme }, res.updatedAt);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Historique"
        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-[var(--color-border)]/40"
      >
        <History className="h-3.5 w-3.5" />
        Historique
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setOpen(false)}
        >
          <aside
            className="flex h-full w-full max-w-sm flex-col border-l bg-[var(--color-bg)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">Historique</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Chaque sauvegarde crée une version restaurable.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-[var(--color-border)]/40"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-2">
              {loading && (
                <div className="px-3 py-8 text-center text-sm text-[var(--color-muted)]">
                  Chargement…
                </div>
              )}
              {!loading && items.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-[var(--color-muted)]">
                  Aucune version sauvegardée pour l&apos;instant.
                </div>
              )}
              <ul className="space-y-1">
                {items.map((r, i) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        Version {items.length - i}
                        {i === 0 && (
                          <span className="ml-2 rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-accent)]">
                            Actuelle
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => restore(r.id)}
                      disabled={pending || i === 0}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-40 hover:bg-[var(--color-border)]/40"
                    >
                      <RotateCcw className={`h-3 w-3 ${restoring === r.id ? "animate-spin" : ""}`} />
                      Restaurer
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
