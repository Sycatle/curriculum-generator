import { renderToBuffer } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { CvDocument } from "./template";
import { CvAtsDocument } from "./template-ats";
import { CvPremiumDocument } from "./template-premium";
import { countPagesInPdfBuffer } from "./measure";
import { applyTruncation, type SpacingTier, type TokenOverrides } from "./tokens";

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

export function passOverrides(pass: number): TokenOverrides {
  return CASCADE[pass]!;
}

/** Build the document element for one cascade pass (shared by server export and client preview). */
export function fitDocument(
  data: CvData,
  theme: Theme,
  locale: "fr" | "en",
  overrides: TokenOverrides,
  paginate: boolean,
) {
  if (theme.template === "ats")
    return <CvAtsDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate={paginate} />;
  if (theme.template === "premium")
    return <CvPremiumDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate={paginate} />;
  return <CvDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate={paginate} />;
}

export type FitReport = {
  /** Index of the cascade pass that was kept. 0 = theme untouched. */
  pass: number;
  fontScale: number;
  spacing: SpacingTier;
  droppedBullets: number;
  droppedExperiences: number;
  /** True if even the most aggressive pass still needed more than one page (end of page 1 is clipped). */
  overflowed: boolean;
  /** Page count of the kept pass with natural pagination (> 1 only when overflowed). */
  pages: number;
  /** What was cut, for display. Bullets dropped inside dropped experiences are not repeated here. */
  dropped: {
    experiences: string[];
    bullets: Array<{ company: string; count: number }>;
  };
};

/** JSON safe for an HTTP header value: non-ASCII chars are \\u-escaped (headers are ByteStrings). */
export function serializeFitReport(r: FitReport): string {
  return JSON.stringify(r).replace(
    /[\u0080-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function buildReport(
  data: CvData,
  theme: Theme,
  pass: number,
  overflowed: boolean,
  pages: number,
): FitReport {
  const o = CASCADE[pass]!;
  const kept = applyTruncation(data, o).experiences;
  const droppedExperiences = data.experiences.slice(kept.length).map((e) => e.company);
  const bullets: FitReport["dropped"]["bullets"] = [];
  kept.forEach((e, i) => {
    const count = data.experiences[i]!.bullets.length - e.bullets.length;
    if (count > 0) bullets.push({ company: e.company, count });
  });
  return {
    pass,
    fontScale: o.fontScale ?? 1,
    spacing: o.spacingTier ?? theme.spacing,
    droppedBullets: bullets.reduce((n, b) => n + b.count, 0),
    droppedExperiences: droppedExperiences.length,
    overflowed,
    pages,
    dropped: { experiences: droppedExperiences, bullets },
  };
}

type RenderFn = (doc: Parameters<typeof renderToBuffer>[0]) => Promise<Uint8Array>;

/**
 * Renderer-agnostic fit cascade: the server passes `renderToBuffer`, the browser
 * preview passes a `pdf().toBlob()` wrapper, so both walk the exact same passes.
 */
export async function fitCascade(
  data: CvData,
  theme: Theme,
  locale: "fr" | "en",
  render: RenderFn,
): Promise<{ bytes: Uint8Array; report: FitReport }> {
  let lastPages = 0;
  for (let i = 0; i < CASCADE.length; i++) {
    const bytes = await render(fitDocument(data, theme, locale, CASCADE[i]!, true));
    lastPages = countPagesInPdfBuffer(bytes);
    if (lastPages <= 1) {
      return { bytes, report: buildReport(data, theme, i, false, lastPages) };
    }
  }
  // Panic clip: enforce 1 page visually.
  const last = CASCADE.length - 1;
  const bytes = await render(fitDocument(data, theme, locale, CASCADE[last]!, false));
  return { bytes, report: buildReport(data, theme, last, true, lastPages) };
}

export type FitResult = {
  buffer: Buffer;
  pass: number;
  /** True if even the most aggressive pass overflowed and we had to clip visually. */
  overflowed: boolean;
  report: FitReport;
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
  const { bytes, report } = await fitCascade(data, theme, locale, async (d) => {
    const b = await renderToBuffer(d);
    return Buffer.isBuffer(b) ? b : Buffer.from(b);
  });
  return {
    buffer: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
    pass: report.pass,
    overflowed: report.overflowed,
    report,
  };
}

export async function renderCvFittedBuffer(
  data: CvData,
  theme: Theme,
  locale: "fr" | "en" = "en",
): Promise<Buffer> {
  const r = await renderCvFitted(data, theme, locale);
  return r.buffer;
}
