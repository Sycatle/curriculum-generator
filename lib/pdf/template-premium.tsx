import { Document, Link as PdfLink, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { formatAtsDate, formatLinkText } from "@/lib/cv/format";
import { applyTruncation, resolveTokens, type ResolvedTokens, type TokenOverrides } from "./tokens";
import { registerFonts } from "./fonts";

registerFonts();

/**
 * Premium template — single column, monochrome accent, hiérarchie typo forte.
 *
 * Critères design 2026 :
 * - une seule colonne (parsing ATS fiable)
 * - polices sans-serif géométriques (Inter)
 * - white-space généreux, grille modulaire
 * - 1 teinte accent unique sur nom + section dividers + liens (pas d'arc-en-ciel)
 * - hiérarchie typo > décoration (pas de pills colorés, pas d'icônes glyphs)
 */

type Props = {
  data: CvData;
  theme: Theme;
  locale?: "fr" | "en";
  overrides?: TokenOverrides;
  paginate?: boolean;
};

function makeStyles(t: ResolvedTokens) {
  const accent = t.colors.accent;
  const text = t.colors.text;
  const muted = t.colors.muted;

  return StyleSheet.create({
    page: {
      fontFamily: t.fonts.body,
      fontSize: t.fontSize.body,
      color: text,
      lineHeight: t.spacing.line,
      paddingHorizontal: t.spacing.pageX + 6,
      paddingVertical: t.spacing.pageY + 4,
    },

    // ----- Header
    headerBlock: {
      borderBottomWidth: 0.75,
      borderBottomColor: accent,
      paddingBottom: 10,
      marginBottom: t.spacing.section + 2,
    },
    name: {
      fontFamily: t.fonts.heading,
      fontWeight: 700,
      fontSize: t.fontSize.name + 4,
      color: accent,
      lineHeight: 1.05,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    role: {
      fontFamily: t.fonts.body,
      fontWeight: 500,
      fontSize: t.fontSize.role + 0.5,
      color: text,
      marginBottom: 8,
    },
    contactLine: {
      fontSize: t.fontSize.small,
      color: muted,
    },
    contactLinks: {
      fontSize: t.fontSize.small,
      color: muted,
      marginTop: 2,
    },
    contactLink: { color: accent, textDecoration: "none" },

    // ----- Section
    sectionWrap: { marginBottom: t.spacing.section + 2 },
    sectionLabel: {
      fontFamily: t.fonts.heading,
      fontWeight: 700,
      fontSize: t.fontSize.sectionLabel,
      color: accent,
      textTransform: "uppercase",
      letterSpacing: 2,
      marginBottom: 6,
    },

    // ----- Summary
    summary: {
      fontSize: t.fontSize.body,
      color: text,
      lineHeight: t.spacing.line,
    },

    // ----- Item (experience, project, education)
    item: { marginBottom: t.spacing.item + 2 },
    itemTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    itemTitle: {
      fontFamily: t.fonts.heading,
      fontWeight: 700,
      fontSize: t.fontSize.itemTitle + 0.5,
      color: text,
    },
    itemCompany: {
      fontFamily: t.fonts.body,
      fontWeight: 500,
      color: accent,
    },
    itemPeriod: {
      fontSize: t.fontSize.small,
      color: muted,
    },
    itemSummary: { marginTop: 2, fontSize: t.fontSize.body, color: text },

    // ----- Bullets
    bulletRow: { flexDirection: "row", marginTop: 3 },
    bulletDot: {
      width: 10,
      color: accent,
      fontSize: t.fontSize.body,
    },
    bulletText: { flex: 1 },

    // ----- Stack — texte inline muted, pas de pills
    stackLine: {
      fontSize: t.fontSize.micro,
      color: muted,
      marginTop: 4,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },

    // ----- Skills (en bloc dense)
    skillRow: { marginBottom: 3, fontSize: t.fontSize.body },
    skillCategory: { fontWeight: 700, color: text },

    // ----- Languages inline
    langLine: { fontSize: t.fontSize.body, color: text },
  });
}

function SectionTitle({
  children,
  styles,
}: {
  children: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function StackLine({ items, styles }: { items: string[]; styles: ReturnType<typeof makeStyles> }) {
  if (items.length === 0) return null;
  return <Text style={styles.stackLine}>{items.join(" · ")}</Text>;
}

export function CvPremiumDocument({
  data: rawData,
  theme,
  locale = "en",
  overrides,
  paginate = true,
}: Props) {
  const tokens = resolveTokens(theme, overrides);
  const styles = makeStyles(tokens);
  const data = applyTruncation(rawData, overrides);

  const contactBits = [data.header.email, data.header.phone, data.header.location].filter(
    (b): b is string => Boolean(b),
  );

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
  };
  const headings = HEADINGS[locale];

  return (
    <Document
      title={`${data.header.name} — ${data.header.title}`}
      author={data.header.name}
      creator="CV Generator"
      producer="CV Generator"
    >
      <Page size="A4" wrap={paginate} style={styles.page}>
        {/* Header block */}
        <View style={styles.headerBlock}>
          <Text style={styles.name}>{data.header.name}</Text>
          <Text style={styles.role}>{data.header.title}</Text>
          {contactBits.length > 0 && (
            <Text style={styles.contactLine}>{contactBits.join("  ·  ")}</Text>
          )}
          {data.header.links.length > 0 && (
            <View style={styles.contactLinks}>
              <Text>
                {data.header.links.map((l, i) => (
                  <Text key={i}>
                    {i > 0 ? "  ·  " : ""}
                    <PdfLink src={l.href} style={styles.contactLink}>
                      {formatLinkText(l.href)}
                    </PdfLink>
                  </Text>
                ))}
              </Text>
            </View>
          )}
        </View>

        {/* Summary */}
        {data.summary && (
          <View style={styles.sectionWrap} wrap={false}>
            <SectionTitle styles={styles}>{headings.summary}</SectionTitle>
            <Text style={styles.summary}>{data.summary}</Text>
          </View>
        )}

        {/* Skills */}
        {data.skills.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle styles={styles}>{headings.skills}</SectionTitle>
            {data.skills.map((g, i) => (
              <Text key={i} style={styles.skillRow}>
                <Text style={styles.skillCategory}>{g.category}: </Text>
                {g.items.join(", ")}
              </Text>
            ))}
          </View>
        )}

        {/* Experience */}
        {data.experiences.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle styles={styles}>{headings.experience}</SectionTitle>
            {data.experiences.map((exp, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>
                    {exp.role}
                    <Text style={{ color: tokens.colors.muted, fontWeight: 400 }}> — </Text>
                    <Text style={styles.itemCompany}>{exp.company}</Text>
                  </Text>
                  <Text style={styles.itemPeriod}>
                    {formatAtsDate(exp.startDate, exp.endDate, locale)}
                    {exp.location ? `  ·  ${exp.location}` : ""}
                  </Text>
                </View>
                {exp.summary && <Text style={styles.itemSummary}>{exp.summary}</Text>}
                {exp.bullets.map((b, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
                <StackLine items={exp.stack} styles={styles} />
              </View>
            ))}
          </View>
        )}

        {/* Projects */}
        {data.projects.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle styles={styles}>{headings.projects}</SectionTitle>
            {data.projects.map((p, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>
                    {p.url ? (
                      <PdfLink src={p.url} style={{ color: tokens.colors.accent, textDecoration: "none" }}>
                        {p.name}
                      </PdfLink>
                    ) : (
                      p.name
                    )}
                  </Text>
                  {p.url && <Text style={styles.itemPeriod}>{formatLinkText(p.url)}</Text>}
                </View>
                <Text style={styles.itemSummary}>{p.description}</Text>
                <StackLine items={p.stack} styles={styles} />
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {data.education.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle styles={styles}>{headings.education}</SectionTitle>
            {data.education.map((e, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>
                    {e.degree}
                    <Text style={{ color: tokens.colors.muted, fontWeight: 400 }}> — </Text>
                    <Text style={styles.itemCompany}>{e.school}</Text>
                  </Text>
                  <Text style={styles.itemPeriod}>
                    {formatAtsDate(e.startDate ?? null, e.endDate ?? null, locale)}
                    {e.location ? `  ·  ${e.location}` : ""}
                  </Text>
                </View>
                {e.details && <Text style={styles.itemSummary}>{e.details}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {data.certifications.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionTitle styles={styles}>{headings.certifications}</SectionTitle>
            {data.certifications.map((c, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle}>
                    {c.name}
                    <Text style={{ color: tokens.colors.muted, fontWeight: 400 }}> — </Text>
                    <Text style={styles.itemCompany}>{c.issuer}</Text>
                  </Text>
                  {c.date && (
                    <Text style={styles.itemPeriod}>
                      {formatAtsDate(c.date, c.date, locale).split(" – ")[0]}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Languages */}
        {data.languages.length > 0 && (
          <View style={styles.sectionWrap} wrap={false}>
            <SectionTitle styles={styles}>{headings.languages}</SectionTitle>
            <Text style={styles.langLine}>
              {data.languages.map((l) => `${l.name} (${l.level})`).join("  ·  ")}
            </Text>
          </View>
        )}

        {/* Interests */}
        {data.interests.length > 0 && (
          <View style={styles.sectionWrap} wrap={false}>
            <SectionTitle styles={styles}>{headings.interests}</SectionTitle>
            <Text style={styles.langLine}>{data.interests.join("  ·  ")}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
