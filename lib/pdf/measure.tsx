import { renderToBuffer } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { CvDocument } from "./template";
import { CvAtsDocument } from "./template-ats";
import { CvPremiumDocument } from "./template-premium";
import type { TokenOverrides } from "./tokens";

export function countPagesInPdfBuffer(buffer: Buffer | Uint8Array): number {
  // @react-pdf/renderer emits one `/Type /Page` object per page. We must avoid
  // matching `/Type /Pages` (the pages tree root) — the trailing character is
  // always a delimiter that isn't a letter/digit.
  const text = Buffer.isBuffer(buffer)
    ? buffer.toString("latin1")
    : Buffer.from(buffer).toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches ? matches.length : 0;
}

export async function countPdfPages(
  data: CvData,
  theme: Theme,
  locale: "fr" | "en" = "en",
  overrides?: TokenOverrides,
): Promise<number> {
  const doc =
    theme.template === "ats" ? (
      <CvAtsDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate />
    ) : theme.template === "premium" ? (
      <CvPremiumDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate />
    ) : (
      <CvDocument data={data} theme={theme} locale={locale} overrides={overrides} paginate />
    );
  const buf = await renderToBuffer(doc);
  return countPagesInPdfBuffer(buf);
}
