import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Github, Sparkles } from "lucide-react";
import { CvHtmlView } from "@/components/preview/cv-html-view";
import { sampleCvData, sampleTheme } from "@/lib/cv/sample";

export const metadata: Metadata = {
  title: "Showcase",
  description:
    "CV de démonstration généré avec cv-generator — preuve que le rendu est propre, structuré et imprimable.",
};

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-semibold">
          ← CV Generator
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <a
            href="https://github.com/sycatle/cv-generator"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-fg)] px-3 py-1.5 font-medium text-[var(--color-bg)] hover:opacity-90"
          >
            Créer le mien
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <header className="mb-8 space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Aperçu HTML — identique au PDF généré
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Voilà ce que ça donne.
          </h1>
          <p className="max-w-2xl text-[var(--color-muted)]">
            Cette page rend exactement le même contenu que le PDF téléchargeable. Les tokens de
            design (couleurs, typographie, espacements) pilotent simultanément le HTML et le PDF —
            une seule source de vérité, deux supports cohérents.
          </p>
        </header>

        <div className="rounded-xl border bg-white p-2 shadow-xl shadow-black/5">
          <CvHtmlView data={sampleCvData} theme={sampleTheme} locale="fr" />
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <Stat label="Format" value="A4 · single ou multipage" />
          <Stat label="Police" value="Inter (bundlée)" />
          <Stat label="Templates" value="Modern + ATS" />
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-fg)] px-5 py-2.5 text-sm font-medium text-[var(--color-bg)] hover:opacity-90"
          >
            Lancer mon CV
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
