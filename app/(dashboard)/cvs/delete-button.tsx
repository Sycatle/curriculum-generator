"use client";

import { useTransition } from "react";
import { deleteCvAction } from "./actions";

export function DeleteCvButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  function onClick() {
    if (!confirm("Delete this CV? This cannot be undone.")) return;
    startTransition(() => deleteCvAction(id));
  }
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="rounded-md border px-3 py-1 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
    >
      {isPending ? "…" : "Delete"}
    </button>
  );
}
