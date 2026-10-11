import { Document, Link as PdfLink, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { CvData, Theme } from "@/lib/cv/schema";
import { SECTION_HEADINGS, labelPrefix } from "@/lib/cv/labels";
import { formatAtsDate, formatLinkText, toMonthYear } from "@/lib/cv/format";
import { mailtoHref, pdfMetadata, telHref } from "./meta";
import { refreshFonts, registerFonts } from "./fonts";
import { applyTruncation, type SpacingTier, type TokenOverrides } from "./tokens";

registerFonts();

type Props = {
  data: CvData;
  theme: Theme;
  locale?: "fr" | "en";
  overrides?: TokenOverrides;
  paginate?: boolean;
};

/**
 * ATS-friendly template (2026 rules).
 *
 * Hard rules applied here, do not "improve" without re-reading the watch in
 * `docs/research/cv-watch-2026.md`:
 * - **Single column** (no flex side-by-side, no tables).
 * - Standard section headings follow the document language (English or French).
 * - **Dates MM/YYYY – Present** via `formatAtsDate()`.
 * - **Canonical order**: Contact → Summary → Skills → Experience → Projects
 *   → Education → Certifications → Languages.
 * - **Plain `•` bullets** (standard glyph, extracted as text by ATS parsers).
 * - **Links visible as text** (`github.com/user`) + clickable, not icons.
 * - No letter-spacing on headings: tracked text is extracted as "P R O F I L" by PDF parsers.
 * - **Safe font** (Inter, fallback Helvetica). Theme colors for hierarchy only, thin rules, no decorative bars.
 */
/**
 * Spacing per tier. `entry` separates two entries, `inner` separates the lines of one entry:
 * entry must stay clearly larger than inner or the entries visually merge.
 */
const ATS_SPACING: Record<
  SpacingTier,
  {
    pageX: number;
    pageY: number;
    sectionTop: number;
    sectionBottom: number;
    entry: number;
    inner: number;
    header: number;
    line: number;
  }
> = {
  ultracompact: { pageX: 26, pageY: 22, sectionTop: 8, sectionBottom: 3, entry: 5, inner: 1, header: 6, line: 1.22 },
  compact: { pageX: 34, pageY: 28, sectionTop: 11, sectionBottom: 4, entry: 7, inner: 1, header: 8, line: 1.3 },
  normal: { pageX: 42, pageY: 36, sectionTop: 14, sectionBottom: 5, entry: 9, inner: 1.5, header: 10, line: 1.38 },
  airy: { pageX: 46, pageY: 40, sectionTop: 18, sectionBottom: 6, entry: 12, inner: 2, header: 12, line: 1.45 },
};

const ATS_BODY = 10;
/** ATS body text never goes below 9pt, whatever the fit cascade asks for. */
const ATS_MIN_BODY = 9;
const RULE_COLOR = "#D1D5DB";
const SKILL_LABEL_WIDTH = 105;

function makeStyles(theme: Theme, overrides?: TokenOverrides) {
  const sp = ATS_SPACING[overrides?.spacingTier ?? theme.spacing];
  const k = Math.max(overrides?.fontScale ?? 1, ATS_MIN_BODY / ATS_BODY);
  const fs = (n: number) => n * k;
  const { text, muted, accent } = theme.colors;
  return StyleSheet.create({
    page: {
      fontFamily: "Inter",
      fontSize: fs(ATS_BODY),
      color: text,
      lineHeight: sp.line,
      paddingHorizontal: sp.pageX,
      paddingVertical: sp.pageY,
    },
    header: {
      paddingBottom: sp.header * 0.8,
      borderBottomWidth: 0.6,
      borderBottomColor: RULE_COLOR,
    },
    // lineHeight explicite : sinon celui de la page est hérité en absolu (calculé sur le corps) et le nom chevauche le titre.
    name: { fontSize: fs(22), lineHeight: 1.15, fontWeight: 700, color: text },
    role: { fontSize: fs(12), lineHeight: 1.3, fontWeight: 500, color: accent, marginTop: 2, marginBottom: sp.inner + 3 },
    contactLine: { fontSize: fs(9.5), color: muted },
    contactLinks: { fontSize: fs(9.5), color: muted, marginTop: 1 },
    sectionLabel: {
      fontSize: fs(10.5),
      lineHeight: 1.3,
      fontWeight: 700,
      color: accent,
      textTransform: "uppercase",
      marginTop: sp.sectionTop,
      marginBottom: sp.sectionBottom,
      paddingBottom: 2,
      borderBottomWidth: 0.5,
      borderBottomColor: RULE_COLOR,
    },
    entry: { marginTop: sp.entry },
    firstEntry: { marginTop: 0 },
    itemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    itemHeadTitle: { flex: 1, paddingRight: 8, fontSize: fs(11), fontWeight: 700, color: text },
    itemHeadSub: { fontSize: fs(10), fontWeight: 400, color: muted },
    itemHeadMeta: { fontSize: fs(9.5), color: muted },
    context: { fontSize: fs(9.5), color: muted, marginTop: sp.inner },
    body: { fontSize: fs(ATS_BODY), marginTop: sp.inner },
    bullet: { flexDirection: "row", marginTop: sp.inner, paddingLeft: 2 },
    bulletDash: { width: 10, fontSize: fs(ATS_BODY), color: muted },
    bulletText: { flex: 1, fontSize: fs(ATS_BODY) },
    stackLine: { fontSize: fs(9), color: muted, marginTop: sp.inner + 1 },
    stackLabel: { fontWeight: 600 },
    skillRow: { flexDirection: "row", marginTop: sp.inner + 1 },
    skillLabel: { width: SKILL_LABEL_WIDTH, paddingRight: 6, fontSize: fs(ATS_BODY), fontWeight: 600 },
    skillItems: { flex: 1, fontSize: fs(ATS_BODY) },
    link: { color: muted, textDecoration: "none" },
    linkText: { color: text, textDecoration: "none" },
  });
}

type Styles = ReturnType<typeof makeStyles>;

function SectionTitle({ children, styles }: { children: string; styles: Styles }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function LinkLine({ href, styles, strong }: { href: string; styles: Styles; strong?: boolean }) {
  return (
    <PdfLink src={href} style={strong ? styles.linkText : styles.link}>
      {formatLinkText(href)}
    </PdfLink>
  );
}

function EntryHead({
  title,
  sub,
  meta,
  styles,
}: {
  title: string;
  sub?: string | null;
  meta?: ReactNode;
  styles: Styles;
}) {
  return (
    <View style={styles.itemHead}>
      <Text style={styles.itemHeadTitle}>
        {title}
        {sub ? <Text style={styles.itemHeadSub}>{` ·\u00A0${sub}`}</Text> : null}
      </Text>
      {meta ? <Text style={styles.itemHeadMeta}>{meta}</Text> : null}
    </View>
  );
}

function StackLine({ stack, label, styles }: { stack: string[]; label: string; styles: Styles }) {
  if (stack.length === 0) return null;
  return (
    <Text style={styles.stackLine}>
      <Text style={styles.stackLabel}>{label}</Text>
      {stack.join(", ")}
    </Text>
  );
}

export function CvAtsDocument({ data: rawData, theme, locale = "en", overrides, paginate = true }: Props) {
  refreshFonts();
  const styles = makeStyles(theme, overrides);
  const data = applyTruncation(rawData, overrides);
  const headings = SECTION_HEADINGS[locale];

  const contactBits: ReactNode[] = [];
  if (data.header.email)
    contactBits.push(
      <PdfLink key="email" src={mailtoHref(data.header.email)} style={styles.link}>
        {data.header.email}
      </PdfLink>,
    );
  if (data.header.phone)
    contactBits.push(
      <PdfLink key="phone" src={telHref(data.header.phone)} style={styles.link}>
        {data.header.phone}
      </PdfLink>,
    );
  if (data.header.location) contactBits.push(data.header.location);

  return (
    <Document {...pdfMetadata(data, locale)}>
      <Page size="A4" wrap={paginate} style={styles.page}>
        {/* Contact bloc — name, title, contact, links — toujours en haut */}
        <View style={styles.header}>
          <Text style={styles.name}>{data.header.name}</Text>
          <Text style={styles.role}>{data.header.title}</Text>
          {contactBits.length > 0 && (
            <Text style={styles.contactLine}>
              {contactBits.map((b, i) => (
                <Text key={i}>
                  {i > 0 ? "  ·  " : ""}
                  {b}
                </Text>
              ))}
            </Text>
          )}
          {data.header.links.length > 0 && (
            <Text style={styles.contactLinks}>
              {data.header.links.map((l, i) => (
                <Text key={i}>
                  {i > 0 ? "  ·  " : ""}
                  <LinkLine styles={styles} href={l.href} />
                </Text>
              ))}
            </Text>
          )}
        </View>

        {/* Canonical order: Summary → Skills → Experience → Projects → Education → Certifications → Languages → Interests */}

        {data.summary && (
          <View wrap={false}>
            <SectionTitle styles={styles}>{headings.summary}</SectionTitle>
            <Text style={styles.body}>{data.summary}</Text>
          </View>
        )}

        {data.skills.length > 0 && (
          <View>
            <SectionTitle styles={styles}>{headings.skills}</SectionTitle>
            {data.skills.map((g, i) => (
              <View key={i} style={styles.skillRow} wrap={false}>
                <Text style={styles.skillLabel}>{labelPrefix(g.category, locale)}</Text>
                <Text style={styles.skillItems}>{g.items.join(", ")}</Text>
              </View>
            ))}
          </View>
        )}

        {data.experiences.length > 0 && (
          <View>
            <SectionTitle styles={styles}>{headings.experience}</SectionTitle>
            {data.experiences.map((e, i) => (
              <View key={i} style={i === 0 ? styles.firstEntry : styles.entry} wrap={false}>
                <EntryHead
                  styles={styles}
                  title={e.company}
                  sub={e.role}
                  meta={`${formatAtsDate(e.startDate, e.endDate, locale)}${e.location ? ` · ${e.location}` : ""}`}
                />
                {e.summary && <Text style={styles.context}>{e.summary}</Text>}
                {e.bullets.map((b, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDash}>•</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
                <StackLine styles={styles} stack={e.stack} label={labelPrefix(headings.stack, locale)} />
              </View>
            ))}
          </View>
        )}

        {data.projects.length > 0 && (
          <View>
            <SectionTitle styles={styles}>{headings.projects}</SectionTitle>
            {data.projects.map((p, i) => {
              const showUrl = p.url && formatLinkText(p.url).toLowerCase() !== p.name.trim().toLowerCase();
              return (
                <View key={i} style={i === 0 ? styles.firstEntry : styles.entry} wrap={false}>
                  <EntryHead
                    styles={styles}
                    title={p.name}
                    meta={showUrl && p.url ? <LinkLine styles={styles} href={p.url} /> : null}
                  />
                  <Text style={styles.body}>{p.description}</Text>
                  <StackLine styles={styles} stack={p.stack} label={labelPrefix(headings.stack, locale)} />
                </View>
              );
            })}
          </View>
        )}

        {data.education.length > 0 && (
          <View>
            <SectionTitle styles={styles}>{headings.education}</SectionTitle>
            {data.education.map((e, i) => {
              const dates = formatAtsDate(e.startDate ?? null, e.endDate ?? null, locale);
              const meta = [dates, e.location].filter(Boolean).join(" · ");
              return (
                <View key={i} style={i === 0 ? styles.firstEntry : styles.entry} wrap={false}>
                  <EntryHead styles={styles} title={e.degree} sub={e.school} meta={meta || null} />
                  {e.details && <Text style={styles.context}>{e.details}</Text>}
                </View>
              );
            })}
          </View>
        )}

        {data.certifications.length > 0 && (
          <View>
            <SectionTitle styles={styles}>{headings.certifications}</SectionTitle>
            {data.certifications.map((c, i) => (
              <Text key={i} style={styles.body}>
                {c.name} — {c.issuer}
                {c.date ? ` (${toMonthYear(c.date)})` : ""}
                {c.url ? " · " : ""}
                {c.url && <LinkLine styles={styles} href={c.url} strong />}
              </Text>
            ))}
          </View>
        )}

        {data.languages.length > 0 && (
          <View>
            <SectionTitle styles={styles}>{headings.languages}</SectionTitle>
            <Text style={styles.body}>
              {data.languages.map((l) => `${l.name} (${l.level})`).join(" · ")}
            </Text>
          </View>
        )}

        {data.interests.length > 0 && (
          <View>
            <SectionTitle styles={styles}>{headings.interests}</SectionTitle>
            <Text style={styles.body}>{data.interests.join(" · ")}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
