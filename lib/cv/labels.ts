export type CvLocale = "fr" | "en";

/** Libellés de sections partagés par le PDF (ats/premium), le DOCX et l'aperçu ATS. */
export const SECTION_HEADINGS = {
  en: {
    summary: "Summary",
    skills: "Skills",
    experience: "Work Experience",
    projects: "Projects",
    education: "Education",
    certifications: "Certifications",
    languages: "Languages",
    interests: "Interests",
    stack: "Tech stack",
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
    stack: "Stack",
  },
} as const satisfies Record<CvLocale, Record<string, string>>;

/** « Libellé : » — espace insécable avant les deux-points en français. */
export function labelPrefix(label: string, locale: CvLocale): string {
  return locale === "fr" ? `${label}\u00A0: ` : `${label}: `;
}
