import { requireSession } from "@/lib/auth/server";
import { CvImportFlow } from "@/components/cms/cv-import-flow";

export const metadata = { title: "Import CV" };

export default async function ImportCvPage() {
  await requireSession();
  return <CvImportFlow />;
}
