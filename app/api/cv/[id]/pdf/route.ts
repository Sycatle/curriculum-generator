import { NextResponse } from "next/server";
import { getCvForUser, getPublicCv } from "@/lib/cv/repository";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getSession();
  const cv = session
    ? (await getCvForUser(id, session.user.id)) ?? (await getPublicCv(id))
    : await getPublicCv(id);

  if (!cv) return new NextResponse("Not found", { status: 404 });

  const { renderCvStream } = await import("@/lib/pdf/render");
  const locale = cv.locale === "fr" ? "fr" : "en";
  const stream = await renderCvStream(cv.data, cv.theme, { locale });
  const filename = `${cv.slug}.pdf`;

  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
