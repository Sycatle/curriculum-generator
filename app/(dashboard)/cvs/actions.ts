"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/server";
import {
  createCv,
  deleteCv as deleteCvRepo,
  getCvForUser,
  listRevisions,
  updateCv,
} from "@/lib/cv/repository";
import { CvDataSchema, CvInputSchema, SlugSchema, ThemeSchema } from "@/lib/cv/schema";
import { countPdfPages } from "@/lib/pdf/measure";
import { blankCvData, defaultTheme } from "@/lib/cv/defaults";

const NewCvInput = z.object({
  title: z.string().trim().min(1).max(120),
  slug: SlugSchema,
});

const ImportedCvInput = z.object({
  title: z.string().trim().min(1).max(120),
  slug: SlugSchema,
  locale: z.enum(["fr", "en"]).default("fr"),
  data: CvDataSchema,
});

export async function createCvAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = NewCvInput.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const cv = await createCv(session.user.id, {
    title: parsed.data.title,
    slug: parsed.data.slug,
    data: blankCvData,
    theme: defaultTheme,
    isPublic: false,
    locale: "fr",
  });
  revalidatePath("/cvs");
  redirect(`/cvs/${cv.id}/edit`);
}

export async function saveCvAction(id: string, payload: unknown) {
  const session = await requireSession();
  const parsed = CvInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid CV data" };
  }
  const updated = await updateCv(id, session.user.id, parsed.data);
  revalidatePath(`/cvs/${id}/edit`);
  revalidatePath(`/cv/${id}`);
  return { ok: true as const, updatedAt: updated.updatedAt.toISOString() };
}

export async function createImportedCvAction(
  raw: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const parsed = ImportedCvInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const cv = await createCv(session.user.id, {
    title: parsed.data.title,
    slug: parsed.data.slug,
    locale: parsed.data.locale,
    data: parsed.data.data,
    theme: defaultTheme,
    isPublic: false,
  });
  revalidatePath("/cvs");
  return { ok: true, id: cv.id };
}

export async function measureCvAction(
  payload: unknown,
): Promise<{ ok: true; pages: number } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const parsed = CvInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid CV data" };
  }
  try {
    const pages = await countPdfPages(
      parsed.data.data,
      parsed.data.theme,
      parsed.data.locale,
    );
    return { ok: true, pages };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Measure failed" };
  }
}

export async function deleteCvAction(id: string) {
  const session = await requireSession();
  await deleteCvRepo(id, session.user.id);
  revalidatePath("/cvs");
}

export async function listRevisionsAction(cvId: string) {
  const session = await requireSession();
  const rows = await listRevisions(cvId, session.user.id, 50);
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString() }));
}

export async function restoreRevisionAction(cvId: string, revisionId: string) {
  const session = await requireSession();
  const current = await getCvForUser(cvId, session.user.id);
  if (!current) return { ok: false as const, error: "CV not found" };

  const all = await listRevisions(cvId, session.user.id, 200);
  const target = all.find((r) => r.id === revisionId);
  if (!target) return { ok: false as const, error: "Revision not found" };

  const restored = await updateCv(cvId, session.user.id, {
    title: current.title,
    slug: current.slug,
    locale: current.locale as "fr" | "en",
    isPublic: current.isPublic,
    data: CvDataSchema.parse(target.data),
    theme: ThemeSchema.parse(target.theme),
  });
  revalidatePath(`/cvs/${cvId}/edit`);
  revalidatePath(`/cv/${cvId}`);
  return {
    ok: true as const,
    data: restored.data,
    theme: restored.theme,
    updatedAt: restored.updatedAt.toISOString(),
  };
}
