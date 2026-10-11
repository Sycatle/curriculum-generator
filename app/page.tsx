import Link from "next/link";
import { ArrowRight, FileText, Github, Layers, Sparkles, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <Hero />
        <Features />
        <Showcase />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-fg)] text-[var(--color-bg)]">
          <FileText className="h-4 w-4" />
        </div>
        <span>CV Generator</span>
      </Link>
      <div className="flex items-center gap-2 text-sm">
        <a
          href="https://github.com/sycatle/curriculum-generator"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)] sm:inline-flex"
        >
          <Github className="h-4 w-4" />
          GitHub
        </a>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-fg)] px-3.5 py-1.5 font-medium text-[var(--color-bg)] hover:opacity-90"
        >
          Sign in
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="grid gap-12 pt-12 pb-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-20">
      <div className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          Open source · Self-hosted · MIT
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Le CV des devs qui en ont marre de Canva.
        </h1>
        <p className="max-w-xl text-lg text-[var(--color-muted)]">
          Édite le contenu, pas la mise en page. Aperçu en direct, export PDF propre, historique
          des versions. Conçu pour livrer plus vite que ton recruteur ne lit ton CV.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-fg)] px-4 py-2.5 text-sm font-medium text-[var(--color-bg)] hover:opacity-90"
          >
            Commencer gratuitement
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/sycatle/curriculum-generator"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-border)]/30"
          >
            <Github className="h-4 w-4" />
            Voir le code
          </a>
        </div>
      </div>

      <div className="relative">
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-[var(--color-accent)]/15 via-transparent to-[var(--color-accent)]/10 blur-2xl" />
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl border bg-white shadow-2xl shadow-black/10">
          <CvMockup />
        </div>
      </div>
    </section>
  );
}

function CvMockup() {
  return (
    <div className="grid h-full grid-cols-[36%_1fr] text-[10px] leading-tight text-neutral-800">
      <aside className="space-y-3 bg-[oklch(0.96_0.02_250)] p-4">
        <div>
          <div className="text-[14px] font-bold leading-tight text-neutral-900">Sycatle</div>
          <div className="text-[9px] font-medium text-[oklch(0.55_0.18_250)]">Software Engineer</div>
        </div>
        <Block label="Contact">
          <div>sycatle@pm.me</div>
          <div>Paris, FR</div>
        </Block>
        <Block label="Compétences">
          <div className="flex flex-wrap gap-1">
            {["TypeScript", "Next.js", "Node", "Postgres", "Tailwind"].map((s) => (
              <span
                key={s}
                className="rounded bg-[oklch(0.55_0.18_250)]/10 px-1 py-px text-[8px] font-medium text-[oklch(0.55_0.18_250)]"
              >
                {s}
              </span>
            ))}
          </div>
        </Block>
        <Block label="Langues">
          <div className="flex justify-between">
            <span>Français</span>
            <span className="text-neutral-500">Natif</span>
          </div>
          <div className="flex justify-between">
            <span>Anglais</span>
            <span className="text-neutral-500">C1</span>
          </div>
        </Block>
      </aside>
      <main className="space-y-3 p-4">
        <Block label="Profil">
          <div className="text-[9px]">
            Ingénieur full-stack avec un goût prononcé pour les systèmes propres et les expériences
            utilisateur soignées.
          </div>
        </Block>
        <Block label="Expérience">
          <div>
            <div className="font-semibold">Senior Engineer · Stripe-like</div>
            <div className="text-[8px] text-neutral-500">2023 — aujourd&apos;hui · Paris</div>
            <div className="mt-1 text-[9px]">
              • Mise à l&apos;échelle de l&apos;API checkout (10× le throughput)
            </div>
            <div className="text-[9px]">• Refonte du dashboard merchant en Next.js 15</div>
          </div>
          <div>
            <div className="font-semibold">Engineer · Startup SaaS</div>
            <div className="text-[8px] text-neutral-500">2021 — 2023</div>
          </div>
        </Block>
        <Block label="Projets">
          <div className="font-semibold text-[oklch(0.55_0.18_250)]">curriculum-generator</div>
          <div className="text-[9px]">Open-source CV builder, ce que tu lis maintenant.</div>
        </Block>
      </main>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 h-px w-3 bg-[oklch(0.55_0.18_250)]" />
      <div className="mb-1 text-[7px] font-semibold uppercase tracking-wider text-neutral-700">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Features() {
  const items = [
    {
      icon: Zap,
      title: "Édite, ne mets pas en page",
      body: "Concentre-toi sur le fond. Le layout reste cohérent, peu importe la longueur ou la langue.",
    },
    {
      icon: Sparkles,
      title: "Aperçu en direct",
      body: "Chaque modification se reflète instantanément dans la preview HTML et PDF.",
    },
    {
      icon: Layers,
      title: "Versions & snapshots",
      body: "Historique automatique. Reviens en arrière en un clic si tu casses quelque chose.",
    },
    {
      icon: FileText,
      title: "PDF propre, A4, une ou plusieurs pages",
      body: "Polices Inter bundlées, layout deux colonnes, identique en HTML et en PDF.",
    },
  ];
  return (
    <section className="border-t py-20">
      <h2 className="mb-12 text-3xl font-semibold tracking-tight">Tout ce qu&apos;il te faut, rien de plus.</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="space-y-2 rounded-lg border p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <Icon className="h-4 w-4" />
            </div>
            <div className="font-semibold">{title}</div>
            <p className="text-sm text-[var(--color-muted)]">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className="border-t py-20">
      <div className="grid gap-8 sm:grid-cols-3">
        <Stat value="< 5 min" label="Pour générer un CV propre depuis zéro" />
        <Stat value="100 %" label="Open-source, MIT, hébergé chez toi" />
        <Stat value="A4 · 1 page" label="Format strict, lisible par tous les ATS" />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function CTA() {
  return (
    <section className="mt-12 rounded-2xl border bg-[var(--color-fg)] px-8 py-16 text-center text-[var(--color-bg)]">
      <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Prêt à arrêter de te battre avec ton CV ?
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-[var(--color-bg)]/70">
        Magic link en deux clics. Aucune carte bancaire. Tu héberges, tu possèdes.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-bg)] px-5 py-2.5 text-sm font-medium text-[var(--color-fg)] hover:opacity-90"
        >
          Lancer mon CV
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-[var(--color-muted)]">
        <span>MIT licensed · Bring your own VPS.</span>
        <a
          href="https://github.com/sycatle/curriculum-generator"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--color-fg)]"
        >
          github.com/sycatle/curriculum-generator
        </a>
      </div>
    </footer>
  );
}
