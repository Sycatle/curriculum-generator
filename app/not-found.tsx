import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-[var(--color-accent)]">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-[var(--color-muted)]">
        The page you&apos;re looking for doesn&apos;t exist or is private.
      </p>
      <Link href="/" className="rounded-md border px-3 py-1 text-sm hover:bg-[var(--color-border)]/30">
        Back home
      </Link>
    </main>
  );
}
