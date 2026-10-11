/**
 * Outreach send pipeline (one (contact, cv) pair).
 *
 *   1. Sanity-check the contact: not unsubscribed, not bounced, not
 *      complained, not previously messaged by this user.
 *   2. Build the disclosure + unsubscribe URL.
 *   3. Render markdown → HTML (with footer).
 *   4. Render the CV to PDF (reuses existing lib/pdf) and attach.
 *   5. Send via Resend.
 *   6. Record on `outreach_message`.
 *
 * Callers (API route or batch worker) are responsible for rate-limiting
 * across mailboxes. This function does ONE send.
 */

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { CvDataSchema, ThemeSchema, type CvData, type Theme } from "@/lib/cv/schema";
import { renderCvBuffer } from "@/lib/pdf/render";
import {
  generateOutreachMessage,
  type CompanyContext,
  type ContactContext,
  type OutreachLang,
} from "./generate-message";
import { buildEmailHtml } from "./render-html";
import {
  hasMessagedContact,
  insertQueuedMessage,
  markMessageFailed,
  markMessageSent,
} from "./repository";
import { getDefaultFromAddress, sendEmail } from "./resend-client";
import { signContactToken } from "./unsubscribe-token";

export interface SendOutreachInput {
  userId: string;
  cvId: string;
  contactId: string;
  /** Override the detected language. If omitted, defaults to company website lang or 'en'. */
  langOverride?: OutreachLang;
  /** Override the Resend `From` address (used for mailbox rotation). */
  fromOverride?: string;
  /** When true, generates everything but does NOT send. Returns the would-be payload. */
  dryRun?: boolean;
}

export interface SendOutreachResult {
  status: "sent" | "skipped" | "preview" | "failed";
  reason?: string;
  messageId?: string; // outreach_message.id (our row)
  resendId?: string; // Resend's id
  subject?: string;
  bodyMarkdown?: string;
  to?: string;
  from?: string;
  lang?: OutreachLang;
}

function publicBaseUrl(): string {
  return (
    process.env.OUTREACH_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function disclosureFor(lang: OutreachLang, reason: string): string {
  if (lang === "fr") {
    return `Vous recevez ce message car ${reason}. Si vous préférez ne plus recevoir de candidatures, cliquez ci-dessous — nous ne vous recontacterons plus.`;
  }
  return `You're receiving this email because ${reason}. If you'd rather not receive job applications, click below — we won't contact you again.`;
}

function unsubscribeLabelFor(lang: OutreachLang): string {
  return lang === "fr" ? "Se désinscrire" : "Unsubscribe";
}

export async function sendOutreach(input: SendOutreachInput): Promise<SendOutreachResult> {
  // 1. Load contact + company + cv
  const [contactRow] = await db
    .select()
    .from(schema.contact)
    .where(eq(schema.contact.id, input.contactId))
    .limit(1);
  if (!contactRow) return { status: "skipped", reason: "Contact not found" };

  if (contactRow.unsubscribedAt) {
    return { status: "skipped", reason: "Contact unsubscribed" };
  }
  if (contactRow.bouncedAt) {
    return { status: "skipped", reason: "Contact previously bounced" };
  }
  if (contactRow.complainedAt) {
    return { status: "skipped", reason: "Contact previously complained" };
  }

  const [companyRow] = await db
    .select()
    .from(schema.company)
    .where(eq(schema.company.id, contactRow.companyId))
    .limit(1);
  if (!companyRow) return { status: "skipped", reason: "Company not found" };
  if (companyRow.userId !== input.userId) {
    return { status: "skipped", reason: "Company not owned by user" };
  }

  if (await hasMessagedContact(input.userId, contactRow.id)) {
    return { status: "skipped", reason: "Already messaged" };
  }

  const [cvRow] = await db
    .select()
    .from(schema.cv)
    .where(eq(schema.cv.id, input.cvId))
    .limit(1);
  if (!cvRow || cvRow.userId !== input.userId) {
    return { status: "skipped", reason: "CV not found" };
  }
  const cvData: CvData = CvDataSchema.parse(cvRow.data);
  const cvTheme: Theme = ThemeSchema.parse(cvRow.theme);

  // 2. Decide language
  const lang: OutreachLang =
    input.langOverride ??
    (companyRow.websiteLang === "fr"
      ? "fr"
      : companyRow.websiteLang === "en"
        ? "en"
        : companyRow.country === "FR"
          ? "fr"
          : "en");

  // 3. Generate the message
  const companyCtx: CompanyContext = {
    name: companyRow.name,
    domain: companyRow.domain,
    city: companyRow.city,
    country: companyRow.country,
    activityLabel: companyRow.activityLabel,
    headcount: companyRow.headcount,
  };
  const contactCtx: ContactContext = {
    email: contactRow.email,
    firstName: contactRow.firstName,
    lastName: contactRow.lastName,
    title: contactRow.title,
    emailKind: contactRow.emailKind === "nominative" ? "nominative" : "generic",
  };

  const message = await generateOutreachMessage({ cv: cvData, company: companyCtx, contact: contactCtx, lang });

  // 4. Build HTML / text
  const token = signContactToken(contactRow.id);
  const unsubscribeUrl = `${publicBaseUrl()}/u/${token}`;
  const disclosure = disclosureFor(lang, message.reason);
  const html = buildEmailHtml({
    bodyMarkdown: message.bodyMarkdown,
    disclosure,
    unsubscribeUrl,
    unsubscribeLabel: unsubscribeLabelFor(lang),
  });
  const text =
    message.bodyMarkdown +
    "\n\n---\n" +
    disclosure +
    "\n" +
    unsubscribeLabelFor(lang) +
    ": " +
    unsubscribeUrl;

  const from = input.fromOverride ?? getDefaultFromAddress();

  if (input.dryRun) {
    return {
      status: "preview",
      subject: message.subject,
      bodyMarkdown: message.bodyMarkdown,
      to: contactRow.email,
      from,
      lang,
    };
  }

  // 5. Persist queued + attempt send + update status
  const queued = await insertQueuedMessage({
    userId: input.userId,
    contactId: contactRow.id,
    cvId: input.cvId,
    lang,
    subject: message.subject,
    bodyMarkdown: message.bodyMarkdown,
    fromAddress: from,
  });

  try {
    const cvPdf = await renderCvBuffer(cvData, cvTheme, { locale: lang });
    const filenameBase = (cvData.header.name || "cv").replace(/[^a-z0-9-]+/gi, "_");
    const sent = await sendEmail({
      from,
      to: contactRow.email,
      subject: message.subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      attachments: [{ filename: `${filenameBase}.pdf`, content: cvPdf }],
      tags: [
        { name: "kind", value: "outreach" },
        { name: "lang", value: lang },
      ],
    });
    await markMessageSent(queued.id, sent.id);
    return {
      status: "sent",
      messageId: queued.id,
      resendId: sent.id,
      subject: message.subject,
      bodyMarkdown: message.bodyMarkdown,
      to: contactRow.email,
      from,
      lang,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    await markMessageFailed(queued.id, msg);
    return { status: "failed", reason: msg, messageId: queued.id };
  }
}
