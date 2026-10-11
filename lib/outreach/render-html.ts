/**
 * Tiny markdown → safe HTML renderer for outreach emails.
 *
 * Supports only what we generate: paragraphs, **bold**, *italic*, links,
 * line breaks. Anything else is escaped. We don't pull a markdown lib to
 * keep the email surface minimal and predictable for spam filters.
 */

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE[c] ?? c);
}

function renderInline(line: string): string {
  let out = escapeHtml(line);
  // links [text](url) — restrict to http(s)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_m, text: string, url: string) => `<a href="${url}">${text}</a>`,
  );
  // bold + italic — applied after escaping (works because ** doesn't include escaped chars)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

export function markdownToHtml(md: string): string {
  const paragraphs = md
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs
    .map((p) => `<p>${renderInline(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export function buildEmailHtml(params: {
  bodyMarkdown: string;
  disclosure: string;
  unsubscribeUrl: string;
  unsubscribeLabel: string;
}): string {
  const body = markdownToHtml(params.bodyMarkdown);
  const disclosure = escapeHtml(params.disclosure);
  const unsubLabel = escapeHtml(params.unsubscribeLabel);
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:640px;margin:0 auto;padding:24px">
${body}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#666">${disclosure}<br><a href="${params.unsubscribeUrl}" style="color:#666">${unsubLabel}</a></p>
</body></html>`;
}
