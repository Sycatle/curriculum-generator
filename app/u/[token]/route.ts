/**
 * Unsubscribe endpoint — handles both:
 *   - GET (human in browser → renders an HTML confirmation page)
 *   - POST (RFC 8058 List-Unsubscribe one-click → just records and returns 200)
 *
 * No auth required, token is signed (HMAC) so it can't be forged.
 */

import { NextResponse } from "next/server";
import { verifyContactToken } from "@/lib/outreach/unsubscribe-token";
import { markContactUnsubscribed } from "@/lib/companies/contact-repository";

export const runtime = "nodejs";

function htmlOk(): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Désinscription confirmée</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:6em auto;padding:0 1em;text-align:center;color:#111}h1{font-size:1.25rem}p{color:#666;font-size:.9rem}</style></head><body><h1>Désinscription confirmée</h1><p>Tu ne recevras plus de messages à cette adresse.</p></body></html>`;
}

function htmlInvalid(): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Lien invalide</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:6em auto;padding:0 1em;text-align:center;color:#111}h1{font-size:1.25rem}p{color:#666;font-size:.9rem}</style></head><body><h1>Lien invalide</h1><p>Ce lien de désinscription n&rsquo;est pas reconnu.</p></body></html>`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contactId = verifyContactToken(token);
  if (!contactId) {
    return new NextResponse(htmlInvalid(), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  await markContactUnsubscribed(contactId);
  return new NextResponse(htmlOk(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contactId = verifyContactToken(token);
  if (!contactId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  await markContactUnsubscribed(contactId);
  return NextResponse.json({ ok: true });
}
