"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { FilePlus, Files, Github, LogOut, Search, Settings } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function signOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <Command
        className="w-full max-w-lg overflow-hidden rounded-lg border bg-[var(--color-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        loop
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 text-[var(--color-muted)]" />
          <Command.Input
            placeholder="Rechercher une action…"
            className="w-full bg-transparent py-3 text-sm outline-none"
            autoFocus
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-1">
          <Command.Empty className="px-3 py-8 text-center text-sm text-[var(--color-muted)]">
            Aucune action trouvée.
          </Command.Empty>
          <Command.Group heading="Navigation" className="text-xs text-[var(--color-muted)]">
            <Item icon={<Files className="h-4 w-4" />} onSelect={() => go("/cvs")}>
              Mes CVs
            </Item>
            <Item icon={<FilePlus className="h-4 w-4" />} onSelect={() => go("/cvs/new")}>
              Nouveau CV
            </Item>
            <Item icon={<Settings className="h-4 w-4" />} onSelect={() => go("/cvs")}>
              Paramètres
            </Item>
          </Command.Group>
          <Command.Group heading="Compte" className="text-xs text-[var(--color-muted)]">
            <Item icon={<LogOut className="h-4 w-4" />} onSelect={signOut}>
              Se déconnecter
            </Item>
          </Command.Group>
          <Command.Group heading="Liens" className="text-xs text-[var(--color-muted)]">
            <Item
              icon={<Github className="h-4 w-4" />}
              onSelect={() => {
                setOpen(false);
                window.open("https://github.com/sycatle/curriculum-generator", "_blank");
              }}
            >
              GitHub
            </Item>
          </Command.Group>
        </Command.List>
        <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-[var(--color-muted)]">
          <span>↑↓ naviguer · ↵ sélectionner</span>
          <kbd className="rounded border px-1.5 py-0.5">esc</kbd>
        </div>
      </Command>
    </div>
  );
}

function Item({
  icon,
  children,
  onSelect,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-[var(--color-border)]/40"
    >
      {icon}
      {children}
    </Command.Item>
  );
}
