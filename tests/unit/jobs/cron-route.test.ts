/**
 * Cron route auth — must reject requests without a valid bearer secret.
 * refreshAllActive is mocked so the test stays DB-free.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jobs/refresh", () => ({
  refreshAllActive: vi.fn(async () => ({
    total: 0,
    ok: 0,
    failed: 0,
    fetched: 0,
    inserted: 0,
    updated: 0,
    perSource: [],
  })),
}));

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret-token";
  vi.resetModules();
});

afterEach(() => {
  process.env.CRON_SECRET = originalSecret;
});

async function importRoute() {
  return (await import("@/app/api/cron/refresh-sources/route")) as {
    POST: (req: Request) => Promise<Response>;
  };
}

describe("POST /api/cron/refresh-sources", () => {
  it("rejects missing authorization header", async () => {
    const { POST } = await importRoute();
    const res = await POST(new Request("http://localhost/api/cron/refresh-sources", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects wrong secret", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      new Request("http://localhost/api/cron/refresh-sources", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await importRoute();
    const res = await POST(
      new Request("http://localhost/api/cron/refresh-sources", {
        method: "POST",
        headers: { authorization: "Bearer anything" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts valid bearer and returns summary", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      new Request("http://localhost/api/cron/refresh-sources", {
        method: "POST",
        headers: { authorization: "Bearer s3cret-token" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(0);
  });
});
