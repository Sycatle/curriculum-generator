/**
 * Greenhouse Job Board submission via the official `applications` endpoint.
 *
 *   POST https://api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}
 *
 * Authentication: HTTP Basic with the *Job Board Token* as username and an
 * empty password (or none — Greenhouse accepts both for public job boards).
 * Form fields: first_name, last_name, email + optional phone, resume,
 * cover_letter, custom question fields. We submit multipart/form-data.
 *
 * Reference: https://developers.greenhouse.io/job-board.html#post-an-application
 */

import type { CvData, Theme } from "@/lib/cv/schema";
import { renderCvBuffer } from "@/lib/pdf/render";

export interface GreenhouseSubmitInput {
  board: string;
  jobId: string; // numeric, but kept as string for safety
  cvData: CvData;
  cvTheme: Theme;
  locale?: "fr" | "en";
  coverLetterText?: string | null;
  /** Phone is required by many Greenhouse-customer ATS configurations. */
  phoneFallback?: string;
}

export interface GreenhouseSubmitResult {
  ok: boolean;
  status: number;
  body: string;
  candidateId?: string | number;
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: parts[0]! };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export async function submitToGreenhouse(
  input: GreenhouseSubmitInput,
): Promise<GreenhouseSubmitResult> {
  const { cvData, cvTheme, board, jobId } = input;
  if (!cvData.header.email) {
    throw new Error("CV must include an email in header");
  }
  const { first, last } = splitName(cvData.header.name);
  const phone = cvData.header.phone ?? input.phoneFallback ?? "";

  const pdf = await renderCvBuffer(cvData, cvTheme, { locale: input.locale ?? "en" });
  const filenameBase = (cvData.header.name || "cv").replace(/[^a-z0-9-]+/gi, "_");

  const form = new FormData();
  form.set("first_name", first);
  form.set("last_name", last);
  form.set("email", cvData.header.email);
  if (phone) form.set("phone", phone);
  if (input.coverLetterText) form.set("cover_letter_text", input.coverLetterText);
  form.set(
    "resume",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    `${filenameBase}.pdf`,
  );

  // Greenhouse expects the board token as Basic-auth username.
  const auth = "Basic " + Buffer.from(`${board}:`).toString("base64");

  const url = `https://api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(jobId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth },
    body: form,
  });
  const text = await res.text();
  let candidateId: string | number | undefined;
  try {
    const parsed = JSON.parse(text) as { id?: string | number; candidate_id?: string | number };
    candidateId = parsed.id ?? parsed.candidate_id;
  } catch {
    // body isn't JSON — that's OK, it might be a form-encoded error
  }
  return { ok: res.ok, status: res.status, body: text.slice(0, 2000), candidateId };
}
