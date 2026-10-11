import { renderToBuffer, renderToStream } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { CvDocument } from "./template";
import { CvAtsDocument } from "./template-ats";
import { CvPremiumDocument } from "./template-premium";
import { renderCvFitted, renderCvFittedBuffer, serializeFitReport, type FitReport } from "./fit";

export type { FitReport } from "./fit";

type RenderOptions = { fit?: boolean; locale?: "fr" | "en" };

function pickDocument(data: CvData, theme: Theme, locale: "fr" | "en") {
  if (theme.template === "ats") return <CvAtsDocument data={data} theme={theme} locale={locale} />;
  if (theme.template === "premium") return <CvPremiumDocument data={data} theme={theme} locale={locale} />;
  return <CvDocument data={data} theme={theme} locale={locale} />;
}

/** Render the CV as one fitted page or naturally paginated pages, per theme. */
export function renderCvBuffer(
  data: CvData,
  theme: Theme,
  opts: RenderOptions = {},
): Promise<Buffer> {
  const fit = opts.fit ?? theme.pageMode === "single";
  const locale = opts.locale ?? "en";
  if (!fit) {
    return renderToBuffer(pickDocument(data, theme, locale)).then((b) =>
      Buffer.isBuffer(b) ? b : Buffer.from(b),
    );
  }
  return renderCvFittedBuffer(data, theme, locale);
}

/**
 * Streamed variant for HTTP responses. Falls back to buffer + Readable when
 * fitting is requested (the fit cascade needs the full buffer to count pages).
 */
export async function renderCvStream(data: CvData, theme: Theme, opts: RenderOptions = {}) {
  const fit = opts.fit ?? theme.pageMode === "single";
  const locale = opts.locale ?? "en";
  if (!fit) {
    return renderToStream(pickDocument(data, theme, locale));
  }
  const { Readable } = await import("node:stream");
  const buf = await renderCvFittedBuffer(data, theme, locale);
  return Readable.from(buf);
}

/**
 * Same as `renderCvStream` but also returns the fit report (null when the
 * theme is multi-page / fit is disabled, since nothing is cut then).
 */
export async function renderCvStreamWithReport(
  data: CvData,
  theme: Theme,
  opts: RenderOptions = {},
): Promise<{ stream: Awaited<ReturnType<typeof renderCvStream>>; fit: FitReport | null; fitHeader: string | null }> {
  const fit = opts.fit ?? theme.pageMode === "single";
  const locale = opts.locale ?? "en";
  if (!fit) return { stream: await renderCvStream(data, theme, opts), fit: null, fitHeader: null };
  const { Readable } = await import("node:stream");
  const r = await renderCvFitted(data, theme, locale);
  return { stream: Readable.from(r.buffer), fit: r.report, fitHeader: serializeFitReport(r.report) };
}
