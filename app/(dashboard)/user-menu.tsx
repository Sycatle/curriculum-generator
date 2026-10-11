"use client";

import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, User } from "lucide-react";
import { authClient } from "@/lib/auth/client";

type Props = { email: string; name: string | null };

export function UserMenu({ email, name }: Props) {
  const router = useRouter();
  const initials = (name ?? email).slice(0, 2).toUpperCase();

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 rounded-full border px-2 py-1 text-sm hover:bg-[var(--color-border)]/30">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[11px] font-semibold text-[var(--color-accent)]">
            {initials}
          </span>
          <span className="hidden max-w-[160px] truncate text-[var(--color-muted)] sm:inline">
            {email}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-muted)]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-md border bg-[var(--color-bg)] p-1 text-sm shadow-lg"
        >
          <div className="px-2 py-1.5 text-xs text-[var(--color-muted)]">Connecté en tant que</div>
          <div className="truncate px-2 pb-2 text-sm font-medium">{email}</div>
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
          <DropdownMenu.Item
            onSelect={() => router.push("/cvs")}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none data-[highlighted]:bg-[var(--color-border)]/40"
          >
            <User className="h-4 w-4" />
            Mes CVs
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={signOut}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-red-600 outline-none data-[highlighted]:bg-red-50 dark:data-[highlighted]:bg-red-950/40"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
