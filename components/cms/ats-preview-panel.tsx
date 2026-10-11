"use client";

import { useMemo } from "react";
import { ScanText } from "lucide-react";
import type { CvData } from "@/lib/cv/schema";
import { renderAtsPreview } from "@/lib/cv/ats-preview";

type Props = {
  data: CvData;
  locale: "fr" | "en";
};

export function AtsPreviewPanel({ data, locale }: Props) {
  const text = useMemo(() => renderAtsPreview(data, locale), [data, locale]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-3 text-sm font-medium">
        <ScanText className="h-4 w-4" />
        Vue ATS (texte extrait)
      </div>
      <p className="border-b p-3 text-xs text-[var(--color-muted)]">
        Texte que verra un ATS après parsing. Si une info ne s'affiche pas ici,
        elle est invisible aux filtres RH.
      </p>
      <pre className="flex-1 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
