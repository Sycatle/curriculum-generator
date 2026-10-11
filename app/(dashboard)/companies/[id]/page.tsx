import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/server";
import { listCvsForUser } from "@/lib/cv/repository";
import { getCompanyForUser } from "@/lib/companies/repository";
import { listContactsForCompany } from "@/lib/companies/contact-repository";
import { listMessagesForContact } from "@/lib/outreach/repository";
import { isResendConfigured } from "@/lib/outreach/resend-client";
import { EnrichButton } from "./enrich-button";
import { OutreachPanel } from "./outreach-panel";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const company = await getCompanyForUser(id, session.user.id);
  if (!company) notFound();
  const [contacts, cvs] = await Promise.all([
    listContactsForCompany(company.id),
    listCvsForUser(session.user.id),
  ]);
  const messagesByContact = new Map<string, Awaited<ReturnType<typeof listMessagesForContact>>>();
  for (const c of contacts) {
    messagesByContact.set(c.id, await listMessagesForContact(c.id));
  }

  const defaultLang: "fr" | "en" =
    company.websiteLang === "en"
      ? "en"
      : company.websiteLang === "fr"
        ? "fr"
        : company.country === "FR"
          ? "fr"
          : "en";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/companies" className="text-xs text-[var(--color-muted)] hover:underline">
          ← Entreprises
        </Link>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          <EnrichButton companyId={company.id} />
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          {company.activityCode ? <span className="font-mono">{company.activityCode}</span> : null}
          {company.city ? ` · ${company.city}${company.postalCode ? ` (${company.postalCode})` : ""}` : ""}
          {company.headcount ? ` · ${company.headcount}` : ""}
          {company.country ? ` · ${company.country}` : ""}
          {company.websiteLang ? ` · lang: ${company.websiteLang}` : ""}
        </p>
        {company.domain ? (
          <a
            href={`https://${company.domain}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm hover:underline"
          >
            {company.domain}
          </a>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">Pas de site web connu.</p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Outreach
        </h2>
        <OutreachPanel
          cvs={cvs.map((c) => ({ id: c.id, title: c.title }))}
          contacts={contacts.map((c) => ({
            id: c.id,
            email: c.email,
            verified: c.verified,
            unsubscribed: !!c.unsubscribedAt,
            bounced: !!c.bouncedAt,
            complained: !!c.complainedAt,
          }))}
          defaultLang={defaultLang}
          resendConfigured={isResendConfigured()}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Contacts ({contacts.length})
        </h2>
        {contacts.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-6 text-sm text-[var(--color-muted)]">
            Aucun contact. Lance « Enrichir » pour générer les adresses génériques (et Dropcontact si
            <span className="font-mono"> DROPCONTACT_API_KEY</span> est configuré).
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {contacts.map((c) => {
              const msgs = messagesByContact.get(c.id) ?? [];
              const lastMsg = msgs[0];
              return (
                <li key={c.id} className="flex items-baseline justify-between gap-4 px-4 py-2">
                  <div>
                    <div className="font-mono text-sm">
                      {c.email}
                      {c.verified ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900">
                          verified
                        </span>
                      ) : (
                        <span className="ml-2 rounded-full border px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                          unverified
                        </span>
                      )}
                      {c.unsubscribedAt ? (
                        <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-900">
                          unsub
                        </span>
                      ) : null}
                      {c.bouncedAt ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
                          bounce
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {c.emailKind === "nominative" ? `${c.firstName ?? ""} ${c.lastName ?? ""} · ` : ""}
                      {c.title ? `${c.title} · ` : ""}
                      {c.source}
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--color-muted)]">
                    {lastMsg ? (
                      <>
                        <div>{lastMsg.status}</div>
                        {lastMsg.sentAt ? (
                          <div>{lastMsg.sentAt.toISOString().slice(0, 10)}</div>
                        ) : null}
                      </>
                    ) : (
                      <span className="italic">jamais contacté</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
