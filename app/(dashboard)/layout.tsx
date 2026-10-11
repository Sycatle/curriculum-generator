import Link from "next/link";
import { Briefcase, Building2, FileText, Files, LayoutDashboard, Send, Settings } from "lucide-react";
import { requireSession } from "@/lib/auth/server";
import { CommandPalette } from "@/components/cms/command-palette";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/cvs", label: "Mes CVs", icon: Files },
  { href: "/cvs/new", label: "Créer", icon: LayoutDashboard },
  { href: "/jobs", label: "Offres", icon: Briefcase },
  { href: "/companies", label: "Entreprises", icon: Building2 },
  { href: "/outreach", label: "Outreach", icon: Send },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-[var(--color-bg)] lg:flex lg:flex-col">
        <Link href="/cvs" className="flex items-center gap-2 px-5 py-4 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-fg)] text-[var(--color-bg)]">
            <FileText className="h-4 w-4" />
          </div>
          CV Generator
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 px-2 pt-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)]/30 hover:text-[var(--color-fg)]"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t px-2 py-2">
          <Link
            href="/cvs"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)]/30 hover:text-[var(--color-fg)]"
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="border-b">
          <div className="flex items-center justify-between px-6 py-3">
            <Link href="/cvs" className="font-semibold lg:hidden">
              CV Generator
            </Link>
            <div className="flex flex-1 items-center justify-end gap-3">
              <kbd className="hidden items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] sm:inline-flex">
                ⌘ K
              </kbd>
              <UserMenu email={session.user.email} name={session.user.name ?? null} />
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
