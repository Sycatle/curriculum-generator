import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/server";
import { db, schema } from "@/lib/db/client";
import { listCvsForUser } from "@/lib/cv/repository";
import { getMailboxStates } from "@/lib/outreach/mailboxes";
import { isResendConfigured } from "@/lib/outreach/resend-client";
import { BatchPanel } from "./batch-panel";
import { Kanban } from "./kanban";

export const metadata = { title: "Outreach" };
export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const session = await requireSession();

  const rows = await db
    .select({
      message: schema.outreachMessage,
      contactEmail: schema.contact.email,
      contactFirstName: schema.contact.firstName,
      contactLastName: schema.contact.lastName,
      companyName: schema.company.name,
      companyDomain: schema.company.domain,
      companyId: schema.company.id,
    })
    .from(schema.outreachMessage)
    .innerJoin(schema.contact, eq(schema.outreachMessage.contactId, schema.contact.id))
    .innerJoin(schema.company, eq(schema.contact.companyId, schema.company.id))
    .where(eq(schema.outreachMessage.userId, session.user.id))
    .orderBy(desc(schema.outreachMessage.createdAt))
    .limit(500);

  const [cvs, mailboxStates] = await Promise.all([
    listCvsForUser(session.user.id),
    getMailboxStates(session.user.id),
  ]);

  const cards = rows.map((r) => ({
    id: r.message.id,
    status: r.message.status,
    subject: r.message.subject,
    lang: r.message.lang,
    sentAt: r.message.sentAt?.toISOString() ?? null,
    createdAt: r.message.createdAt.toISOString(),
    contactEmail: r.contactEmail,
    contactName:
      [r.contactFirstName, r.contactLastName].filter(Boolean).join(" ").trim() || null,
    companyName: r.companyName,
    companyDomain: r.companyDomain,
    companyId: r.companyId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Outreach</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Pipeline candidatures spontanées. Funnel : Sent → Replied → Interview → Hired / Lost.
        </p>
      </div>

      <BatchPanel
        cvs={cvs.map((c) => ({ id: c.id, title: c.title }))}
        mailboxes={mailboxStates}
        resendConfigured={isResendConfigured()}
      />

      <Kanban cards={cards} />
    </div>
  );
}
