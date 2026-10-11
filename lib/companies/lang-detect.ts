/**
 * Detect a company website's primary language by fetching the homepage,
 * stripping to a short text sample, and asking Claude Haiku to classify it.
 *
 * Returns 'fr' | 'en' | 'both' (a site that ships side-by-side). Used to
 * decide which language to write the outreach email in.
 *
 * Heuristic fallback (no LLM call): if HTML `<html lang>` attribute is set
 * and is fr/en, use it directly. Saves a Claude call per company.
 */

import { getAnthropic, MODELS } from "@/lib/ai/client";

export type WebsiteLang = "fr" | "en" | "both";

const HTML_LANG_RE = /<html[^>]*\blang=["']([a-zA-Z-]+)["']/i;
const STRIP_TAGS = /<[^>]+>/g;
const STRIP_WHITESPACE = /\s+/g;

async function fetchHomepage(domain: string): Promise<string | null> {
  const candidates = [`https://${domain}`, `http://${domain}`];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 curriculum-generator/lang-detect" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return await res.text();
    } catch {
      // try next candidate
    }
  }
  return null;
}

function quickLangFromHtml(html: string): WebsiteLang | null {
  const m = html.match(HTML_LANG_RE);
  if (!m) return null;
  const lang = m[1]!.toLowerCase().slice(0, 2);
  if (lang === "fr") return "fr";
  if (lang === "en") return "en";
  return null;
}

function extractTextSample(html: string, maxChars = 1500): string {
  // Drop scripts and styles, then strip remaining tags.
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(STRIP_TAGS, " ")
    .replace(STRIP_WHITESPACE, " ")
    .trim();
  return cleaned.slice(0, maxChars);
}

export async function detectWebsiteLang(domain: string): Promise<WebsiteLang | null> {
  const html = await fetchHomepage(domain);
  if (!html) return null;

  const quick = quickLangFromHtml(html);
  if (quick) return quick;

  if (!process.env.ANTHROPIC_API_KEY) return null;

  const sample = extractTextSample(html);
  if (!sample) return null;

  const anthropic = getAnthropic();
  const resp = await anthropic.messages.create({
    model: MODELS.cheap,
    max_tokens: 16,
    system:
      "You classify website text by primary language. Reply with exactly one token: fr, en, or both (when the site visibly ships side-by-side translations of equal weight). No prose.",
    messages: [{ role: "user", content: sample }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim()
    .toLowerCase();

  if (text.startsWith("fr")) return "fr";
  if (text.startsWith("en")) return "en";
  if (text.startsWith("both")) return "both";
  return null;
}
