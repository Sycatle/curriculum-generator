import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { CvDataSchema, CvInputSchema, ThemeSchema, type CvInput } from "./schema";
import { blankCvData, defaultTheme } from "./defaults";

export type CvRecord = typeof schema.cv.$inferSelect;

function parse(record: CvRecord) {
  return {
    ...record,
    data: CvDataSchema.parse(record.data),
    theme: ThemeSchema.parse(record.theme),
  };
}

export async function listCvsForUser(userId: string) {
  const rows = await db
    .select()
    .from(schema.cv)
    .where(eq(schema.cv.userId, userId))
    .orderBy(desc(schema.cv.updatedAt));
  return rows.map(parse);
}

export async function getCvForUser(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(schema.cv)
    .where(and(eq(schema.cv.id, id), eq(schema.cv.userId, userId)))
    .limit(1);
  return row ? parse(row) : null;
}

export async function getPublicCv(id: string) {
  const [row] = await db
    .select()
    .from(schema.cv)
    .where(and(eq(schema.cv.id, id), eq(schema.cv.isPublic, true)))
    .limit(1);
  return row ? parse(row) : null;
}

export async function createCv(userId: string, input: Partial<CvInput> & { title: string; slug: string }) {
  const payload = CvInputSchema.parse({
    title: input.title,
    slug: input.slug,
    locale: input.locale ?? "fr",
    data: input.data ?? blankCvData,
    theme: input.theme ?? defaultTheme,
    isPublic: input.isPublic ?? false,
  });

  const [row] = await db
    .insert(schema.cv)
    .values({
      userId,
      slug: payload.slug,
      title: payload.title,
      locale: payload.locale,
      data: payload.data,
      theme: payload.theme,
      isPublic: payload.isPublic,
    })
    .returning();

  if (!row) throw new Error("Failed to insert CV");
  return parse(row);
}

export async function updateCv(id: string, userId: string, input: CvInput) {
  const payload = CvInputSchema.parse(input);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.cv)
      .set({
        slug: payload.slug,
        title: payload.title,
        locale: payload.locale,
        data: payload.data,
        theme: payload.theme,
        isPublic: payload.isPublic,
        publishedAt: payload.isPublic ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.cv.id, id), eq(schema.cv.userId, userId)))
      .returning();

    if (!updated) throw new Error("CV not found or access denied");

    await tx.insert(schema.cvRevision).values({
      cvId: updated.id,
      data: payload.data,
      theme: payload.theme,
    });

    return parse(updated);
  });
}

export async function deleteCv(id: string, userId: string) {
  const result = await db
    .delete(schema.cv)
    .where(and(eq(schema.cv.id, id), eq(schema.cv.userId, userId)))
    .returning({ id: schema.cv.id });
  return result.length > 0;
}

export async function listRevisions(cvId: string, userId: string, limit = 20) {
  // Authorization: only the owner can list revisions.
  const [owner] = await db
    .select({ userId: schema.cv.userId })
    .from(schema.cv)
    .where(eq(schema.cv.id, cvId))
    .limit(1);
  if (!owner || owner.userId !== userId) return [];

  return db
    .select()
    .from(schema.cvRevision)
    .where(eq(schema.cvRevision.cvId, cvId))
    .orderBy(desc(schema.cvRevision.createdAt))
    .limit(limit);
}
