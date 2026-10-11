import { Document, Link as PdfLink, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { formatAtsDate, formatLinkText } from "@/lib/cv/format";
import { registerFonts } from "./fonts";
import { applyTruncation, type TokenOverrides } from "./tokens";

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
 * - **Plain ASCII bullets** ("- " prefix, no `•` glyph).
 * - **Links visible as text** (`github.com/user`) + clickable, not icons.
 * - **Safe font** (Inter, fallback Helvetica). No color, no decorative bars.
 */
const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10.5,
    color: "#111111",
    lineHeight: 1.4,
    paddingHorizontal: 40,
    paddingVertical: 36,
  },
  name: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  role: { fontSize: 11, fontWeight: 500, color: "#333333", marginBottom: 6 },
  contactLine: { fontSize: 9.5, color: "#222222", marginBottom: 2 },
  contactLinks: { fontSize: 9.5, color: "#222222", marginBottom: 12 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 0.6,
    borderBottomColor: "#000000",
  },
  itemBlock: { marginTop: 6 },
  itemTitleLine: { fontSize: 10.5, fontWeight: 700 },
  itemMeta: { fontSize: 9.5, color: "#333333", marginTop: 1 },
  body: { fontSize: 10.5, marginTop: 2 },
  bullet: { flexDirection: "row", marginTop: 2, paddingLeft: 4 },
  bulletDash: { width: 10, fontSize: 10.5 },
  bulletText: { flex: 1, fontSize: 10.5 },
  stackLine: { fontSize: 10, color: "#222222", marginTop: 2 },
  link: { color: "#111111", textDecoration: "none" },
});

const HEADINGS = {
  en: {
    summary: "Summary",
    skills: "Skills",
    experience: "Work Experience",
    projects: "Projects",
    education: "Education",
    certifications: "Certifications",
    languages: "Languages",
    interests: "Interests",
  },
  fr: {
    summary: "Profil",
    skills: "Compétences",
    experience: "Expérience professionnelle",
    projects: "Projets",
    education: "Formation",
    certifications: "Certifications",
    languages: "Langues",
    interests: "Centres d’intérêt",
  },
} as const;

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function LinkLine({ href }: { href: string }) {
  return (
    <PdfLink src={href} style={styles.link}>
      {formatLinkText(href)}
    </PdfLink>
  );
}

export function CvAtsDocument({ data: rawData, locale = "en", overrides, paginate = true }: Props) {
  const data = applyTruncation(rawData, overrides);
  const headings = HEADINGS[locale];

  const contactBits = [data.header.email, data.header.phone, data.header.location].filter(
    (b): b is string => Boolean(b),
  );

  return (
    <Document
      title={`${data.header.name} — ${data.header.title}`}
      author={data.header.name}
      creator="CV Generator"
      producer="CV Generator"
    >
      <Page size="A4" wrap={paginate} style={styles.page}>
        {/* Contact bloc — name, title, contact, links — toujours en haut */}
        <Text style={styles.name}>{data.header.name}</Text>
        <Text style={styles.role}>{data.header.title}</Text>
        {contactBits.length > 0 && (
          <Text style={styles.contactLine}>{contactBits.join(" · ")}</Text>
        )}
        {data.header.links.length > 0 && (
          <View style={styles.contactLinks}>
            <Text>
              {data.header.links.map((l, i) => (
                <Text key={i}>
                  {i > 0 ? " · " : ""}
                  <LinkLine href={l.href} />
                </Text>
              ))}
            </Text>
          </View>
        )}

        {/* Canonical order: Summary → Skills → Experience → Projects → Education → Certifications → Languages → Interests */}

        {data.summary && (
          <View wrap={false}>
            <SectionTitle>{headings.summary}</SectionTitle>
            <Text style={styles.body}>{data.summary}</Text>
          </View>
        )}

        {data.skills.length > 0 && (
          <View>
            <SectionTitle>{headings.skills}</SectionTitle>
            {data.skills.map((g, i) => (
              <Text key={i} style={styles.body}>
                <Text style={{ fontWeight: 700 }}>{g.category}:</Text> {g.items.join(", ")}
              </Text>
            ))}
          </View>
        )}

        {data.experiences.length > 0 && (
          <View>
            <SectionTitle>{headings.experience}</SectionTitle>
            {data.experiences.map((e, i) => (
              <View key={i} style={styles.itemBlock} wrap={false}>
                <Text style={styles.itemTitleLine}>
                  {e.role} — {e.company}
                </Text>
                <Text style={styles.itemMeta}>
                  {formatAtsDate(e.startDate, e.endDate, locale)}
                  {e.location ? ` · ${e.location}` : ""}
                </Text>
                {e.summary && <Text style={styles.body}>{e.summary}</Text>}
                {e.bullets.map((b, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDash}>-</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
                {e.stack.length > 0 && (
                  <Text style={styles.stackLine}>Tech stack: {e.stack.join(", ")}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {data.projects.length > 0 && (
          <View>
            <SectionTitle>{headings.projects}</SectionTitle>
            {data.projects.map((p, i) => (
              <View key={i} style={styles.itemBlock} wrap={false}>
                <Text style={styles.itemTitleLine}>{p.name}</Text>
                {p.url && (
                  <Text style={styles.itemMeta}>
                    <LinkLine href={p.url} />
                  </Text>
                )}
                <Text style={styles.body}>{p.description}</Text>
                {p.stack.length > 0 && (
                  <Text style={styles.stackLine}>Tech stack: {p.stack.join(", ")}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {data.education.length > 0 && (
          <View>
            <SectionTitle>{headings.education}</SectionTitle>
            {data.education.map((e, i) => (
              <View key={i} style={styles.itemBlock} wrap={false}>
                <Text style={styles.itemTitleLine}>
                  {e.degree} — {e.school}
                </Text>
                <Text style={styles.itemMeta}>
                  {formatAtsDate(e.startDate ?? null, e.endDate ?? null, locale)}
                  {e.location ? ` · ${e.location}` : ""}
                </Text>
                {e.details && <Text style={styles.body}>{e.details}</Text>}
              </View>
            ))}
          </View>
        )}

        {data.certifications.length > 0 && (
          <View>
            <SectionTitle>{headings.certifications}</SectionTitle>
            {data.certifications.map((c, i) => (
              <Text key={i} style={styles.body}>
                {c.name} — {c.issuer}
                {c.date ? ` (${formatAtsDate(c.date, c.date, locale).split(" – ")[0]})` : ""}
                {c.url ? " · " : ""}
                {c.url && <LinkLine href={c.url} />}
              </Text>
            ))}
          </View>
        )}

        {data.languages.length > 0 && (
          <View>
            <SectionTitle>{headings.languages}</SectionTitle>
            <Text style={styles.body}>
              {data.languages.map((l) => `${l.name} (${l.level})`).join(" · ")}
            </Text>
          </View>
        )}

        {data.interests.length > 0 && (
          <View>
            <SectionTitle>{headings.interests}</SectionTitle>
            <Text style={styles.body}>{data.interests.join(" · ")}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
