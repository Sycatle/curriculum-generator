import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { applyTruncation, resolveTokens, type ResolvedTokens, type TokenOverrides } from "./tokens";
import { registerFonts } from "./fonts";
import { formatPeriod } from "./format";

registerFonts();

type Props = {
  data: CvData;
  theme: Theme;
  locale?: "fr" | "en";
  overrides?: TokenOverrides;
  /** When false, content overflow is clipped to a single page (no pagination). */
  paginate?: boolean;
};

function makeStyles(t: ResolvedTokens, sidebarRatio: number) {
  return StyleSheet.create({
    page: {
      fontFamily: t.fonts.body,
      fontSize: t.fontSize.body,
      color: t.colors.text,
      lineHeight: t.spacing.line,
      padding: 0,
    },
    body: {
      flexDirection: "row",
      flexGrow: 1,
      width: "100%",
      minHeight: "100%",
    },
    sidebar: {
      width: `${sidebarRatio * 100}%`,
      backgroundColor: t.colors.surface,
      paddingHorizontal: t.spacing.pageX * 0.7,
      paddingVertical: t.spacing.pageY,
    },
    main: {
      width: `${(1 - sidebarRatio) * 100}%`,
      paddingHorizontal: t.spacing.pageX,
      paddingVertical: t.spacing.pageY,
    },

    // Identity
    name: {
      fontFamily: t.fonts.heading,
      fontWeight: 700,
      fontSize: t.fontSize.name,
      color: t.colors.primary,
      lineHeight: 1.1,
      marginBottom: 4,
    },
    role: {
      fontFamily: t.fonts.body,
      fontWeight: 500,
      fontSize: t.fontSize.role,
      color: t.colors.accent,
      marginBottom: t.spacing.section,
    },

    // Section header (sidebar + main share this style)
    sectionWrap: { marginBottom: t.spacing.section },
    sectionRule: {
      width: 18,
      height: 1.5,
      backgroundColor: t.colors.accent,
      marginBottom: 3,
    },
    sectionLabel: {
      fontFamily: t.fonts.heading,
      fontWeight: 600,
      fontSize: t.fontSize.sectionLabel,
      color: t.colors.primary,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 5,
    },

    // Contact / sidebar lines
    sidebarText: { fontSize: t.fontSize.small, color: t.colors.text, marginBottom: 3 },
    sidebarMuted: {
      fontSize: t.fontSize.micro,
      color: t.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    sidebarLink: { color: t.colors.accent, textDecoration: "none" },

    // Skills (sidebar)
    skillGroup: { marginBottom: t.spacing.item },

    // Languages (sidebar)
    langRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 3,
      fontSize: t.fontSize.small,
    },

    // Education (sidebar)
    eduItem: { marginBottom: t.spacing.item },
    eduDegree: {
      fontFamily: t.fonts.heading,
      fontWeight: 600,
      fontSize: t.fontSize.small,
      color: t.colors.text,
    },
    eduSchool: { fontSize: t.fontSize.small, color: t.colors.accent, marginTop: 1 },
    eduMeta: { fontSize: t.fontSize.micro, color: t.colors.muted, marginTop: 1 },

    // Summary (main)
    summary: {
      fontSize: t.fontSize.body,
      color: t.colors.text,
      lineHeight: t.spacing.line,
      marginBottom: t.spacing.section,
    },

    // Experience / Projects items (main)
    item: { marginBottom: t.spacing.item + 2 },
    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 2,
    },
    itemTitle: {
      fontFamily: t.fonts.heading,
      fontWeight: 600,
      fontSize: t.fontSize.itemTitle,
      color: t.colors.text,
    },
    itemCompany: { color: t.colors.accent, fontWeight: 500 },
    itemPeriod: {
      fontSize: t.fontSize.small,
      color: t.colors.muted,
    },
    itemSummary: { marginTop: 2, fontSize: t.fontSize.body },

    bulletRow: { flexDirection: "row", marginTop: 3 },
    bulletDot: {
      width: 9,
      color: t.colors.accent,
      fontSize: t.fontSize.body,
    },
    bulletText: { flex: 1 },

    // Pills (stack)
    pillsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 6,
    },
    pill: {
      backgroundColor: t.colors.pill,
      color: t.colors.accent,
      fontSize: t.fontSize.micro,
      fontFamily: t.fonts.body,
      fontWeight: 500,
      paddingVertical: 1.5,
      paddingHorizontal: 5,
      borderRadius: 2,
      marginRight: 3,
      marginBottom: 3,
    },
  });
}

function SectionHeader({
  label,
  styles,
}: {
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View>
      <View style={styles.sectionRule} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function Pills({
  items,
  styles,
}: {
  items: string[];
  styles: ReturnType<typeof makeStyles>;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.pillsRow}>
      {items.map((s, i) => (
        <Text key={i} style={styles.pill}>
          {s}
        </Text>
      ))}
    </View>
  );
}

export function CvDocument({ data: rawData, theme, locale = "fr", overrides, paginate = true }: Props) {
  const tokens = resolveTokens(theme, overrides);
  const styles = makeStyles(tokens, tokens.layout.sidebarRatio);
  const data = applyTruncation(rawData, overrides);

  return (
    <Document
      title={`${data.header.name} — ${data.header.title}`}
      author={data.header.name}
      creator="CV Generator"
      producer="CV Generator"
    >
      <Page size="A4" wrap={paginate} style={styles.page}>
        <View style={styles.body}>
        {/* ----------- Sidebar ----------- */}
        <View style={styles.sidebar}>
          <Text style={styles.name}>{data.header.name}</Text>
          <Text style={styles.role}>{data.header.title}</Text>

          {/* Contact */}
          <View style={styles.sectionWrap}>
            <SectionHeader label={locale === "fr" ? "Contact" : "Contact"} styles={styles} />
            {data.header.email && <Text style={styles.sidebarText}>{data.header.email}</Text>}
            {data.header.phone && <Text style={styles.sidebarText}>{data.header.phone}</Text>}
            {data.header.location && (
              <Text style={styles.sidebarText}>{data.header.location}</Text>
            )}
          </View>

          {/* Links */}
          {data.header.links.length > 0 && (
            <View style={styles.sectionWrap}>
              <SectionHeader label={locale === "fr" ? "Liens" : "Links"} styles={styles} />
              {data.header.links.map((link, i) => (
                <Link key={i} src={link.href} style={[styles.sidebarText, styles.sidebarLink]}>
                  {link.label}
                </Link>
              ))}
            </View>
          )}

          {/* Skills */}
          {data.skills.length > 0 && (
            <View style={styles.sectionWrap}>
              <SectionHeader label={locale === "fr" ? "Compétences" : "Skills"} styles={styles} />
              {data.skills.map((g, i) => (
                <View key={i} style={styles.skillGroup}>
                  <Text style={styles.sidebarMuted}>{g.category}</Text>
                  <Pills items={g.items} styles={styles} />
                </View>
              ))}
            </View>
          )}

          {/* Languages */}
          {data.languages.length > 0 && (
            <View style={styles.sectionWrap}>
              <SectionHeader label={locale === "fr" ? "Langues" : "Languages"} styles={styles} />
              {data.languages.map((l, i) => (
                <View key={i} style={styles.langRow}>
                  <Text>{l.name}</Text>
                  <Text style={{ color: tokens.colors.muted }}>{l.level}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Interests (sidebar bottom) */}
          {data.interests.length > 0 && (
            <View style={styles.sectionWrap}>
              <SectionHeader
                label={locale === "fr" ? "Intérêts" : "Interests"}
                styles={styles}
              />
              <Pills items={data.interests} styles={styles} />
            </View>
          )}

          {/* Education */}
          {data.education.length > 0 && (
            <View style={styles.sectionWrap}>
              <SectionHeader label={locale === "fr" ? "Formation" : "Education"} styles={styles} />
              {data.education.map((e, i) => (
                <View key={i} style={styles.eduItem} wrap={false}>
                  <Text style={styles.eduDegree}>{e.degree}</Text>
                  <Text style={styles.eduSchool}>{e.school}</Text>
                  <Text style={styles.eduMeta}>
                    {formatPeriod(e.startDate, e.endDate ?? null, locale)}
                    {e.location ? ` · ${e.location}` : ""}
                  </Text>
                  {e.details && (
                    <Text style={[styles.sidebarText, { marginTop: 2 }]}>{e.details}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ----------- Main column ----------- */}
        <View style={styles.main}>
          {data.summary && (
            <View style={styles.sectionWrap}>
              <SectionHeader label={locale === "fr" ? "Profil" : "Profile"} styles={styles} />
              <Text style={styles.summary}>{data.summary}</Text>
            </View>
          )}

          {data.experiences.length > 0 && (
            <View style={styles.sectionWrap}>
              <SectionHeader label={locale === "fr" ? "Expérience" : "Experience"} styles={styles} />
              {data.experiences.map((exp, i) => (
                <View key={i} style={styles.item} wrap={false}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>
                      {exp.role}
                      <Text style={{ color: tokens.colors.muted, fontWeight: 400 }}> · </Text>
                      <Text style={styles.itemCompany}>{exp.company}</Text>
                    </Text>
                    <Text style={styles.itemPeriod}>
                      {formatPeriod(exp.startDate, exp.endDate, locale)}
                      {exp.location ? ` · ${exp.location}` : ""}
                    </Text>
                  </View>
                  {exp.summary && <Text style={styles.itemSummary}>{exp.summary}</Text>}
                  {exp.bullets.map((b, j) => (
                    <View key={j} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                  <Pills items={exp.stack} styles={styles} />
                </View>
              ))}
            </View>
          )}

          {data.certifications.length > 0 && (
            <View style={styles.sectionWrap}>
              <SectionHeader
                label={locale === "fr" ? "Certifications" : "Certifications"}
                styles={styles}
              />
              {data.certifications.map((c, i) => (
                <View key={i} style={styles.item} wrap={false}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>
                      {c.name}
                      <Text style={{ color: tokens.colors.muted, fontWeight: 400 }}> · </Text>
                      <Text style={styles.itemCompany}>{c.issuer}</Text>
                    </Text>
                    {c.date && <Text style={styles.itemPeriod}>{c.date}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {data.projects.length > 0 && (
            <View style={styles.sectionWrap}>
              <SectionHeader label={locale === "fr" ? "Projets" : "Projects"} styles={styles} />
              {data.projects.map((p, i) => (
                <View key={i} style={styles.item} wrap={false}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>
                      {p.url ? (
                        <Link src={p.url} style={{ color: tokens.colors.accent, textDecoration: "none" }}>
                          {p.name}
                        </Link>
                      ) : (
                        p.name
                      )}
                    </Text>
                  </View>
                  <Text style={styles.itemSummary}>{p.description}</Text>
                  <Pills items={p.stack} styles={styles} />
                </View>
              ))}
            </View>
          )}
        </View>
        </View>
      </Page>
    </Document>
  );
}
