import type { CvData } from "@/lib/cv/schema";

type Locale = "fr" | "en";

/** Document-info entries shared by the three templates. */
export function pdfMetadata(data: CvData, locale: Locale) {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const group of data.skills) {
    for (const raw of group.items) {
      const item = raw.trim();
      const key = item.toLowerCase();
      if (!item || seen.has(key)) continue;
      seen.add(key);
      keywords.push(item);
    }
  }
  return {
    title: `${data.header.name} — ${data.header.title}`,
    author: data.header.name,
    subject: data.header.title,
    keywords: keywords.join(", "),
    language: locale === "fr" ? "fr-FR" : "en-US",
    creator: "CV Generator",
    producer: "CV Generator",
  };
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}

/** `06 12 34 56 78` / `+33 (0)6 12 34 56 78` → `tel:+33612345678`. */
export function telHref(phone: string): string {
  let p = phone.trim().replace(/\(0\)/g, "");
  p = p.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  else if (/^0\d{9}$/.test(p)) p = `+33${p.slice(1)}`;
  return `tel:${p}`;
}
