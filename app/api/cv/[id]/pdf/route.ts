import { NextResponse } from "next/server";
import { getCvForUser, getPublicCv } from "@/lib/cv/repository";
import { contentDisposition } from "@/lib/cv/filename";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getSession();
  const cv = session
    ? (await getCvForUser(id, session.user.id)) ?? (await getPublicCv(id))
    : await getPublicCv(id);

  if (!cv) return new NextResponse("Not found", { status: 404 });

  const { renderCvStreamWithReport } = await import("@/lib/pdf/render");
  const locale = cv.locale === "fr" ? "fr" : "en";
  const { stream, fitHeader } = await renderCvStreamWithReport(cv.data, cv.theme, { locale });
  const download = new URL(req.url).searchParams.get("download") === "1";

  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(cv.data.header, "pdf", download),
      "Cache-Control": "private, no-store",
      ...(fitHeader ? { "X-CV-Fit": fitHeader } : {}),
    },
  });
}
