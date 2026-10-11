/**
 * Connector parser tests. Network is stubbed via global fetch — no real
 * HTTP. We assert that each connector normalizes its source-specific
 * payload into the shared `NormalizedPosting` shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { greenhouseConnector } from "@/lib/jobs/sources/greenhouse";
import { leverConnector } from "@/lib/jobs/sources/lever";
import { hnConnector } from "@/lib/jobs/sources/hn-algolia";
import { NormalizedPostingSchema } from "@/lib/jobs/schema";

const originalFetch = global.fetch;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("greenhouse connector", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        jobs: [
          {
            id: 12345,
            internal_job_id: 1,
            title: "Senior Software Engineer",
            absolute_url: "https://boards.greenhouse.io/acme/jobs/12345",
            location: { name: "Remote — EU" },
            content: "<p>Build great <strong>software</strong>.</p>",
            updated_at: "2026-05-01T10:00:00Z",
            departments: [{ id: 1, name: "Engineering" }],
            offices: [],
            metadata: null,
          },
        ],
      }),
    );
  });

  it("normalizes a posting", async () => {
    const out = await greenhouseConnector.fetch({ board: "acme" });
    expect(out).toHaveLength(1);
    const posting = out[0]!;
    expect(NormalizedPostingSchema.parse(posting)).toBeTruthy();
    expect(posting.externalId).toBe("12345");
    expect(posting.title).toBe("Senior Software Engineer");
    expect(posting.company).toBe("acme");
    expect(posting.remote).toBe(true);
    expect(posting.descriptionText).toContain("Build great software");
    expect(posting.descriptionText).not.toContain("<");
    expect(posting.department).toBe("Engineering");
  });

  it("throws on non-OK HTTP", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(greenhouseConnector.fetch({ board: "missing" })).rejects.toThrow(/HTTP 404/);
  });
});

describe("lever connector", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () =>
      jsonResponse([
        {
          id: "abc-123",
          text: "Staff Engineer",
          hostedUrl: "https://jobs.lever.co/foo/abc-123",
          applyUrl: "https://jobs.lever.co/foo/abc-123/apply",
          categories: {
            team: "Platform",
            department: "Engineering",
            location: "Paris, France",
            commitment: "Full-time",
            allLocations: ["Paris, France", "Remote (EU)"],
          },
          descriptionPlain: "Lead the platform.",
          description: "<p>Lead the platform.</p>",
          createdAt: 1714000000000,
        },
      ]),
    );
  });

  it("normalizes a posting", async () => {
    const out = await leverConnector.fetch({ site: "foo" });
    expect(out).toHaveLength(1);
    const posting = out[0]!;
    expect(posting.externalId).toBe("abc-123");
    expect(posting.title).toBe("Staff Engineer");
    expect(posting.location).toBe("Paris, France");
    expect(posting.remote).toBe(true);
    expect(posting.employmentType).toBe("Full-time");
    expect(posting.department).toBe("Engineering");
    expect(posting.postedAt).toBeInstanceOf(Date);
  });
});

describe("hn connector", () => {
  beforeEach(() => {
    let call = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      call++;
      if (url.includes("algolia.com")) {
        return jsonResponse({
          hits: [
            {
              objectID: "1000",
              title: "Ask HN: Who is hiring? (May 2026)",
              created_at_i: 1714500000,
              num_comments: 1,
            },
          ],
        });
      }
      if (url.endsWith("/v0/item/1000.json")) {
        return jsonResponse({ id: 1000, type: "story", kids: [2001] });
      }
      if (url.endsWith("/v0/item/2001.json")) {
        return jsonResponse({
          id: 2001,
          type: "comment",
          time: 1714500100,
          text: "Acme Corp | Senior TypeScript Engineer | REMOTE (EU)<p>We are building cool things.<p>Apply: https://apply.example.com/2001",
          parent: 1000,
        });
      }
      throw new Error(`unexpected url ${url} (call ${call})`);
    });
  });

  it("normalizes a comment into a posting", async () => {
    const out = await hnConnector.fetch({ monthsBack: 1 });
    expect(out).toHaveLength(1);
    const p = out[0]!;
    expect(p.externalId).toBe("hn-2001");
    expect(p.company).toBe("Acme Corp");
    expect(p.title).toBe("Senior TypeScript Engineer");
    expect(p.remote).toBe(true);
    expect(p.url).toBe("https://apply.example.com/2001");
    expect(p.descriptionText).toContain("building cool things");
  });
});
