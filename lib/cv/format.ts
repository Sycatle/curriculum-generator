/**
 * Normalisation de formats utilisés à la fois par les templates PDF/DOCX et
 * par les checks ATS. Source de vérité unique pour les dates et les liens.
 *
 * Règle ATS 2026 : dates au format MM/YYYY cohérentes partout (`03/2023 –
 * Present`). Les parsers ne reconnaissent ni "Mars 2023", ni "2023".
 */

/** Convertit `YYYY` ou `YYYY-MM` en `MM/YYYY`. Tolère valeurs vides. */
export function toMonthYear(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  const ym = /^(\d{4})(?:-(\d{1,2}))?$/.exec(s);
  if (!ym) return s; // déjà formaté ou inconnu — pass-through
  const [, year, month] = ym;
  if (!month) return `01/${year}`;
  return `${month.padStart(2, "0")}/${year}`;
}

/**
 * Formateur de période unique (PDF, DOCX, aperçu HTML et ATS). Mois toujours
 * numérique (les ATS parsent mieux MM/YYYY que "mars 2023"). `end = null` →
 * « aujourd'hui » (fr) / « Present » (en).
 */
export function formatAtsDate(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: "fr" | "en" = "en",
): string {
  const s = toMonthYear(start);
  if (!s) return "";
  const e = end ? toMonthYear(end) : null;
  const presentLabel = locale === "fr" ? "aujourd'hui" : "Present";
  if (e === s) return s;
  return `${s} – ${e ?? presentLabel}`;
}

/**
 * Affichage texte d'un lien pour ATS : `github.com/user` plutôt qu'une icône.
 * Strip protocol, www., et trailing slash.
 */
export function formatLinkText(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}
