import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signContactToken, verifyContactToken } from "@/lib/outreach/unsubscribe-token";

const origSecret = process.env.BETTER_AUTH_SECRET;

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-do-not-use-in-prod";
});

afterEach(() => {
  if (origSecret) process.env.BETTER_AUTH_SECRET = origSecret;
  else delete process.env.BETTER_AUTH_SECRET;
});

describe("unsubscribe token", () => {
  it("round-trips a contact id", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const token = signContactToken(id);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyContactToken(token)).toBe(id);
  });

  it("rejects a forged token", () => {
    const id = "abc";
    const token = signContactToken(id);
    // Flip a character in the signature half
    const dot = token.indexOf(".");
    const tampered =
      token.slice(0, dot + 1) +
      (token[dot + 1] === "A" ? "B" : "A") +
      token.slice(dot + 2);
    expect(verifyContactToken(tampered)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyContactToken("nodothere")).toBeNull();
    expect(verifyContactToken(".only-sig")).toBeNull();
    expect(verifyContactToken("only-id.")).toBeNull();
  });

  it("rejects when secret is different", () => {
    const id = "xyz";
    const token = signContactToken(id);
    process.env.BETTER_AUTH_SECRET = "a-different-secret";
    expect(verifyContactToken(token)).toBeNull();
  });
});
