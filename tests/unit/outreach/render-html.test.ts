import { describe, expect, it } from "vitest";
import { buildEmailHtml, markdownToHtml } from "@/lib/outreach/render-html";

describe("markdownToHtml", () => {
  it("renders paragraphs separated by blank lines", () => {
    const out = markdownToHtml("Para one.\n\nPara two.");
    expect(out).toBe("<p>Para one.</p>\n<p>Para two.</p>");
  });

  it("escapes raw HTML to prevent injection", () => {
    const out = markdownToHtml("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("supports inline bold/italic and http(s) links", () => {
    const out = markdownToHtml("Hi **bold** and *italic* and [a link](https://example.com).");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain('<a href="https://example.com">a link</a>');
  });

  it("does not turn javascript: pseudo-URLs into clickable anchors", () => {
    const out = markdownToHtml("evil [click](javascript:alert(1)) here");
    expect(out).not.toContain("<a ");
    // The literal text "javascript:" may survive as plain text — that's
    // harmless since the email renders it as text, not an active link.
  });
});

describe("buildEmailHtml", () => {
  it("wraps the body and appends the disclosure + unsub link", () => {
    const html = buildEmailHtml({
      bodyMarkdown: "Hello there.",
      disclosure: "You were contacted because reasons.",
      unsubscribeUrl: "https://example.com/u/tok",
      unsubscribeLabel: "Unsubscribe",
    });
    expect(html).toContain("<p>Hello there.</p>");
    expect(html).toContain("You were contacted because reasons.");
    expect(html).toContain('href="https://example.com/u/tok"');
    expect(html).toContain("Unsubscribe");
  });
});
