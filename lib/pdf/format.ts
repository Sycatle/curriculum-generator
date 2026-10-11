export function formatPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: "fr" | "en" = "fr",
): string {
  if (!start) return "";
  const fmt = (s: string) => {
    const [y, m] = s.split("-");
    if (!m) return y ?? s;
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      year: "numeric",
    });
  };
  const endText = end ? fmt(end) : locale === "fr" ? "Aujourd’hui" : "Present";
  return `${fmt(start)} — ${endText}`;
}
