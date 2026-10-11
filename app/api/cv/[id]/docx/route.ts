import { NextResponse } from "next/server";
import { getCvForUser, getPublicCv } from "@/lib/cv/repository";
import { contentDisposition } from "@/lib/cv/filename";
import { getSession } from "@/lib/auth/server";
import { renderCvDocxBuffer } from "@/lib/cv/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getSession();
  const cv = session
    ? ((await getCvForUser(id, session.user.id)) ?? (await getPublicCv(id)))
    : await getPublicCv(id);

  if (!cv) return new NextResponse("Not found", { status: 404 });

  const buffer = await renderCvDocxBuffer(cv.data, cv.locale === "fr" ? "fr" : "en");
  const download = new URL(req.url).searchParams.get("download") === "1";

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": contentDisposition(cv.data.header, "docx", download),
      "Cache-Control": "private, no-store",
    },
  });
}
