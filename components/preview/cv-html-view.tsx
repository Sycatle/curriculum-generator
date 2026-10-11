import type { CvData, Theme } from "@/lib/cv/schema";
import { formatPeriod } from "@/lib/pdf/format";

function withAlpha(hex: string, alpha: number) {
  const v = hex.replace("#", "");
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${v}${a}`;
}

type Props = { data: CvData; theme: Theme; locale?: "fr" | "en" };

function SectionHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="mb-3">
      <div className="mb-2 h-[2px] w-6" style={{ backgroundColor: accent }} />
      <h2
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--cv-primary)" }}
      >
        {label}
      </h2>
    </div>
  );
}

function Pills({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <span
          key={i}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: "var(--cv-pill)",
            color: "var(--cv-accent)",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

export function CvHtmlView({ data, theme, locale = "fr" }: Props) {
  const surface = withAlpha(theme.colors.accent, 0.08);
  const pill = withAlpha(theme.colors.accent, 0.12);

  const cssVars = {
    "--cv-primary": theme.colors.primary,
    "--cv-text": theme.colors.text,
    "--cv-muted": theme.colors.muted,
    "--cv-accent": theme.colors.accent,
    "--cv-surface": surface,
    "--cv-pill": pill,
  } as React.CSSProperties;

  return (
    <article
      className="grid grid-cols-1 overflow-hidden rounded-lg border shadow-sm md:grid-cols-[36%_1fr]"
      style={{
        ...cssVars,
        color: "var(--cv-text)",
        fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        backgroundColor: "white",
      }}
    >
      {/* ---------- Sidebar ---------- */}
      <aside
        className="space-y-6 p-7"
        style={{ backgroundColor: "var(--cv-surface)" }}
      >
        <header>
          <h1
            className="text-3xl font-bold leading-tight"
            style={{ color: "var(--cv-primary)" }}
          >
            {data.header.name}
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: "var(--cv-accent)" }}>
            {data.header.title}
          </p>
        </header>

        <section>
          <SectionHeader label="Contact" accent={theme.colors.accent} />
          <ul className="space-y-1 text-xs">
            {data.header.email && (
              <li>
                <a href={`mailto:${data.header.email}`} className="hover:underline">
                  {data.header.email}
                </a>
              </li>
            )}
            {data.header.phone && <li>{data.header.phone}</li>}
            {data.header.location && <li>{data.header.location}</li>}
          </ul>
        </section>

        {data.header.links.length > 0 && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Liens" : "Links"}
              accent={theme.colors.accent}
            />
            <ul className="space-y-1 text-xs">
              {data.header.links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: "var(--cv-accent)" }}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.skills.length > 0 && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Compétences" : "Skills"}
              accent={theme.colors.accent}
            />
            <div className="space-y-3">
              {data.skills.map((g, i) => (
                <div key={i}>
                  <p
                    className="text-[9px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--cv-muted)" }}
                  >
                    {g.category}
                  </p>
                  <Pills items={g.items} />
                </div>
              ))}
            </div>
          </section>
        )}

        {data.languages.length > 0 && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Langues" : "Languages"}
              accent={theme.colors.accent}
            />
            <ul className="space-y-1 text-xs">
              {data.languages.map((l, i) => (
                <li key={i} className="flex justify-between">
                  <span>{l.name}</span>
                  <span style={{ color: "var(--cv-muted)" }}>{l.level}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.interests.length > 0 && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Intérêts" : "Interests"}
              accent={theme.colors.accent}
            />
            <Pills items={data.interests} />
          </section>
        )}

        {data.education.length > 0 && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Formation" : "Education"}
              accent={theme.colors.accent}
            />
            <div className="space-y-3">
              {data.education.map((e, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold" style={{ color: "var(--cv-text)" }}>
                    {e.degree}
                  </p>
                  <p className="text-xs" style={{ color: "var(--cv-accent)" }}>
                    {e.school}
                  </p>
                  <p
                    className="text-[10px] uppercase tracking-wide"
                    style={{ color: "var(--cv-muted)" }}
                  >
                    {formatPeriod(e.startDate, e.endDate ?? null, locale)}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                  {e.details && <p className="mt-1 text-xs">{e.details}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      {/* ---------- Main ---------- */}
      <main className="space-y-6 p-8">
        {data.summary && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Profil" : "Profile"}
              accent={theme.colors.accent}
            />
            <p className="text-sm leading-relaxed">{data.summary}</p>
          </section>
        )}

        {data.experiences.length > 0 && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Expérience" : "Experience"}
              accent={theme.colors.accent}
            />
            <div className="space-y-5">
              {data.experiences.map((exp, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-semibold">{exp.role}</span>
                      <span style={{ color: "var(--cv-muted)" }}> · </span>
                      <span style={{ color: "var(--cv-accent)" }}>{exp.company}</span>
                    </p>
                    <p className="text-xs" style={{ color: "var(--cv-muted)" }}>
                      {formatPeriod(exp.startDate, exp.endDate, locale)}
                      {exp.location ? ` · ${exp.location}` : ""}
                    </p>
                  </div>
                  {exp.summary && <p className="mt-1 text-sm">{exp.summary}</p>}
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {exp.bullets.map((b, j) => (
                        <li key={j} className="flex gap-2">
                          <span style={{ color: "var(--cv-accent)" }}>•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pills items={exp.stack} />
                </div>
              ))}
            </div>
          </section>
        )}

        {data.certifications.length > 0 && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Certifications" : "Certifications"}
              accent={theme.colors.accent}
            />
            <div className="space-y-3">
              {data.certifications.map((c, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
                  <p>
                    <span className="font-semibold">{c.name}</span>
                    <span style={{ color: "var(--cv-muted)" }}> · </span>
                    <span style={{ color: "var(--cv-accent)" }}>{c.issuer}</span>
                  </p>
                  {c.date && <span className="text-xs" style={{ color: "var(--cv-muted)" }}>{c.date}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.projects.length > 0 && (
          <section>
            <SectionHeader
              label={locale === "fr" ? "Projets" : "Projects"}
              accent={theme.colors.accent}
            />
            <div className="space-y-4">
              {data.projects.map((p, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--cv-accent)" }}
                      >
                        {p.name}
                      </a>
                    ) : (
                      p.name
                    )}
                  </p>
                  <p className="mt-1 text-sm">{p.description}</p>
                  <Pills items={p.stack} />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </article>
  );
}
