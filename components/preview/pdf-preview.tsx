"use client";

import { PDFViewer } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { CvDocument } from "@/lib/pdf/template";
import { CvAtsDocument } from "@/lib/pdf/template-ats";
import { CvPremiumDocument } from "@/lib/pdf/template-premium";

export function PdfPreview({
  data,
  theme,
  locale,
}: {
  data: CvData;
  theme: Theme;
  locale: "fr" | "en";
}) {
  const Doc =
    theme.template === "ats"
      ? CvAtsDocument
      : theme.template === "premium"
        ? CvPremiumDocument
        : CvDocument;
  return (
    <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: "none" }}>
      <Doc data={data} theme={theme} locale={locale} />
    </PDFViewer>
  );
}
