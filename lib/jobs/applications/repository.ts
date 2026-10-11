import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

export type JobApplicationRecord = typeof schema.jobApplication.$inferSelect;

export interface CreateApplicationInput {
  userId: string;
  postingId: string;
  cvId: string;
  cvRevisionId?: string | null;
  submitStrategy: string;
  coverLetterText?: string | null;
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<JobApplicationRecord> {
  const [row] = await db
    .insert(schema.jobApplication)
    .values({
      userId: input.userId,
      postingId: input.postingId,
      cvId: input.cvId,
      cvRevisionId: input.cvRevisionId ?? null,
      submitStrategy: input.submitStrategy,
      coverLetterText: input.coverLetterText ?? null,
      status: "queued",
    })
    .returning();
  return row!;
}

export async function markApplicationSubmitted(
  id: string,
  externalRef: string | undefined,
  responseBody: string,
): Promise<void> {
  await db
    .update(schema.jobApplication)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      externalRef: externalRef ?? null,
      response: { body: responseBody },
      updatedAt: new Date(),
      error: null,
    })
    .where(eq(schema.jobApplication.id, id));
}

export async function markApplicationFailed(
  id: string,
  error: string,
  responseBody?: string,
): Promise<void> {
  await db
    .update(schema.jobApplication)
    .set({
      status: "failed",
      error,
      response: responseBody ? { body: responseBody } : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.jobApplication.id, id));
}

export async function getApplicationByPosting(
  userId: string,
  postingId: string,
): Promise<JobApplicationRecord | null> {
  const [row] = await db
    .select()
    .from(schema.jobApplication)
    .where(
      and(
        eq(schema.jobApplication.userId, userId),
        eq(schema.jobApplication.postingId, postingId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listApplicationsForUser(
  userId: string,
  limit = 100,
): Promise<JobApplicationRecord[]> {
  return db
    .select()
    .from(schema.jobApplication)
    .where(eq(schema.jobApplication.userId, userId))
    .orderBy(desc(schema.jobApplication.createdAt))
    .limit(limit);
}

export async function setApplicationStatus(
  id: string,
  userId: string,
  status: string,
): Promise<JobApplicationRecord | null> {
  const [row] = await db
    .update(schema.jobApplication)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(schema.jobApplication.id, id), eq(schema.jobApplication.userId, userId)))
    .returning();
  return row ?? null;
}
