import { renderToBuffer } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { CvDocument } from "./template";
import { CvAtsDocument } from "./template-ats";
import { CvPremiumDocument } from "./template-premium";
import { countPagesInPdfBuffer } from "./measure";
import type { SpacingTier, TokenOverrides } from "./tokens";

type Pass = {
  spacingTier?: SpacingTier;
  fontScale?: number;
  maxBulletsPerExp?: number;
  maxExperiences?: number;
};

// Cascade from least to most aggressive. Pass 0 keeps the theme as-is.
const CASCADE: Pass[] = [
  {},
  { spacingTier: "normal" },
  { spacingTier: "compact" },
  { spacingTier: "compact", fontScale: 0.95 },
  { spacingTier: "compact", fontScale: 0.9 },
  { spacingTier: "ultracompact", fontScale: 0.9 },
  { spacingTier: "ultracompact", fontScale: 0.88, maxBulletsPerExp: 5 },
  { spacingTier: "ultracompact", fontScale: 0.85, maxBulletsPerExp: 4, maxExperiences: 6 },
  { spacingTier: "ultracompact", fontScale: 0.85, maxBulletsPerExp: 3, maxExperiences: 5 },
];

function doc(
  data: CvData,
  theme: Theme,
  overrides: TokenOverrides,
  paginate: boolean,
  locale: "fr" | "en",
) {
  if (theme.template === "ats")
    return <CvAtsDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate={paginate} />;
  if (theme.template === "premium")
    return <CvPremiumDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate={paginate} />;
  return <CvDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate={paginate} />;
}

async function renderBuf(
  data: CvData,
  theme: Theme,
  overrides: TokenOverrides,
  paginate: boolean,
  locale: "fr" | "en",
): Promise<Buffer> {
  const b = await renderToBuffer(doc(data, theme, overrides, paginate, locale));
  return Buffer.isBuffer(b) ? b : Buffer.from(b);
}

export type FitResult = {
  buffer: Buffer;
  pass: number;
  /** True if even the most aggressive pass overflowed and we had to clip visually. */
  overflowed: boolean;
};

/**
 * Render the CV ensuring the output is exactly one A4 page.
 *
 * Strategy:
 *   1. Walk the cascade with natural pagination enabled — first pass that
 *      produces a single page wins.
 *   2. If no pass fits, re-render the most aggressive pass with `paginate=false`
 *      which clips overflow at page 1. The user gets ONE page no matter what,
 *      at the cost of visually cutting content (signaled via `overflowed: true`).
 */
export async function renderCvFitted(
  data: CvData,
  theme: Theme,
  locale: "fr" | "en" = "en",
): Promise<FitResult> {
  for (let i = 0; i < CASCADE.length; i++) {
    const buf = await renderBuf(data, theme, CASCADE[i]!, true, locale);
    if (countPagesInPdfBuffer(buf) <= 1) {
      return { buffer: buf, pass: i, overflowed: false };
    }
  }
  // Panic clip: enforce 1 page visually.
  const last = CASCADE[CASCADE.length - 1]!;
  const clipped = await renderBuf(data, theme, last, false, locale);
  return { buffer: clipped, pass: CASCADE.length - 1, overflowed: true };
}

export async function renderCvFittedBuffer(
  data: CvData,
  theme: Theme,
  locale: "fr" | "en" = "en",
): Promise<Buffer> {
  const r = await renderCvFitted(data, theme, locale);
  return r.buffer;
}
