import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { extractCvFromFile, type ExtractLocale } from "@/lib/ai/extract-cv";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const localeRaw = form.get("locale");
  const locale: ExtractLocale = localeRaw === "en" ? "en" : "fr";

  try {
    const data = await extractCvFromFile(file, locale);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    const status = message.startsWith("Unsupported") || message.startsWith("File too large") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
