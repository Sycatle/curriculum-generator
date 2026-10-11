import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/server";
import { getCvForUser } from "@/lib/cv/repository";
import { CvEditor } from "@/components/cms/cv-editor";

export const metadata = { title: "Edit CV" };

export default async function EditCvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const cv = await getCvForUser(id, session.user.id);
  if (!cv) notFound();

  return (
    <CvEditor
      id={cv.id}
      initial={{
        title: cv.title,
        slug: cv.slug,
        locale: cv.locale as "fr" | "en",
        data: cv.data,
        theme: cv.theme,
        isPublic: cv.isPublic,
      }}
      updatedAt={cv.updatedAt.toISOString()}
    />
  );
}
