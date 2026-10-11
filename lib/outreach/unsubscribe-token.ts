/**
 * Compact signed token for unsubscribe links.
 *
 *   <base64url(contactId)>.<base64url(hmacSha256(contactId, secret))>
 *
 * No expiry — a contact should always be able to unsubscribe.
 * Secret: BETTER_AUTH_SECRET (already required by the app).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return secret;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export function signContactToken(contactId: string): string {
  const sig = createHmac("sha256", getSecret()).update(contactId).digest();
  return `${b64url(contactId)}.${b64url(sig)}`;
}

export function verifyContactToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const idPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  let contactId: string;
  let sig: Buffer;
  try {
    contactId = fromB64url(idPart).toString("utf8");
    sig = fromB64url(sigPart);
  } catch {
    return null;
  }
  const expected = createHmac("sha256", getSecret()).update(contactId).digest();
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(sig, expected)) return null;
  return contactId;
}
