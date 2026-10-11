"use client";

import { useEffect, useState } from "react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import type { CvData, Theme } from "@/lib/cv/schema";
import { fitCascade, fitDocument, passOverrides, type FitReport } from "@/lib/pdf/fit";
import type { TokenOverrides } from "@/lib/pdf/tokens";

type View = { overrides: TokenOverrides; paginate: boolean };

const NATURAL: View = { overrides: {}, paginate: true };

/**
 * In single-page mode the preview walks the same fit cascade as the PDF export
 * (lib/pdf/fit.tsx), so what is shown is what the recruiter receives.
 */
export function PdfPreview({
  data,
  theme,
  locale,
  onFitReport,
}: {
  data: CvData;
  theme: Theme;
  locale: "fr" | "en";
  onFitReport?: (report: FitReport | null) => void;
}) {
  const single = theme.pageMode === "single";
  const [view, setView] = useState<View | null>(single ? null : NATURAL);

  useEffect(() => {
    if (!single) {
      setView(NATURAL);
      onFitReport?.(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { report } = await fitCascade(data, theme, locale, async (d) =>
        new Uint8Array(await (await pdf(d).toBlob()).arrayBuffer()),
      );
      if (cancelled) return;
      setView({ overrides: passOverrides(report.pass), paginate: !report.overflowed });
      onFitReport?.(report);
    })();
    return () => {
      cancelled = true;
    };
    // onFitReport is a state setter / stable callback from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme, locale, single]);

  if (!view) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
        Calcul de l’ajustement une page…
      </div>
    );
  }
  return (
    <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: "none" }}>
      {fitDocument(data, theme, locale, view.overrides, view.paginate)}
    </PDFViewer>
  );
}
