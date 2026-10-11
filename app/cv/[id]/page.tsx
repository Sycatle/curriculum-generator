import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCv } from "@/lib/cv/repository";
import { CvHtmlView } from "@/components/preview/cv-html-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cv = await getPublicCv(id);
  if (!cv) return { title: "CV not found" };
  return {
    title: `${cv.data.header.name} — ${cv.data.header.title}`,
    description: cv.data.summary?.slice(0, 160),
    robots: { index: false, follow: false },
  };
}

export default async function PublicCvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cv = await getPublicCv(id);
  if (!cv) notFound();

  return (
    <div lang={cv.locale} className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-end">
        <a
          href={`/api/cv/${cv.id}/pdf?download=1`}
          className="rounded-md border px-3 py-1 text-sm hover:bg-[var(--color-border)]/30"
        >
          Download PDF
        </a>
      </div>
      <CvHtmlView data={cv.data} theme={cv.theme} locale={cv.locale === "en" ? "en" : "fr"} />
    </div>
  );
}
