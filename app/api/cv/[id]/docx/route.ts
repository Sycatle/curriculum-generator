import { NextResponse } from "next/server";
import { getCvForUser, getPublicCv } from "@/lib/cv/repository";
import { getSession } from "@/lib/auth/server";
import { renderCvDocxBuffer } from "@/lib/cv/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getSession();
  const cv = session
    ? ((await getCvForUser(id, session.user.id)) ?? (await getPublicCv(id)))
    : await getPublicCv(id);

  if (!cv) return new NextResponse("Not found", { status: 404 });

  const buffer = await renderCvDocxBuffer(cv.data, (cv.locale as "fr" | "en") ?? "en");
  const filename = `${cv.slug}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
