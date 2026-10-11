/**
 * Hacker News "Who's Hiring" via Algolia API.
 *
 * Strategy: find the most recent "Ask HN: Who is hiring?" stories from
 * `whoishiring`, then fetch their top-level comments — each comment is one
 * job posting (free-form text). Parse URLs as the apply link when possible.
 */

import type { HnConfig, NormalizedPosting, SourceConnector } from "../schema";
import { applyIngestFilter } from "./ingest-filter";

interface AlgoliaStory {
  objectID: string;
  title: string;
  created_at_i: number;
  num_comments: number;
}

interface AlgoliaSearchResp<T> {
  hits: T[];
}

interface HnItem {
  id: number;
  by?: string;
  text?: string;
  time?: number;
  kids?: number[];
  parent?: number;
  type: string;
}

const URL_RE = /https?:\/\/[^\s<"')]+/g;
const REMOTE_RE = /\b(remote|anywhere|distributed|worldwide|wfh)\b/i;
const TITLE_GUESS_RE = /^([^\n|()\-—–]+?)(?:\s*[|()\-—–]\s*|\n)/;

function stripHtml(html: string): string {
  return html
    .replace(/<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .trim();
}

function guessCompanyAndTitle(text: string): { company: string; title: string } {
  // Common formats:
  //   "Company | Role | Location | REMOTE"
  //   "Company (City, Remote) - Senior Engineer"
  //   "Company is hiring a ..."
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  const pipeParts = firstLine.split(/\s*\|\s*/);
  if (pipeParts.length >= 2) {
    return { company: pipeParts[0]!.trim(), title: pipeParts[1]!.trim() };
  }
  const m = firstLine.match(/^(.+?)\s+(?:is\s+)?hiring\b(?:\s+a)?\s+(.+?)(?:[.!]|$)/i);
  if (m) {
    return { company: m[1]!.trim(), title: m[2]!.trim() };
  }
  const guess = firstLine.match(TITLE_GUESS_RE);
  if (guess) {
    return { company: guess[1]!.trim(), title: firstLine.slice(guess[0].length).trim() || firstLine };
  }
  return { company: firstLine.slice(0, 60) || "HN", title: firstLine.slice(0, 120) || "Position" };
}

async function findHiringStories(monthsBack: number): Promise<AlgoliaStory[]> {
  const url =
    "https://hn.algolia.com/api/v1/search_by_date?" +
    new URLSearchParams({
      tags: "story,author_whoishiring",
      hitsPerPage: String(monthsBack),
    }).toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HN Algolia stories: HTTP ${res.status}`);
  const data = (await res.json()) as AlgoliaSearchResp<AlgoliaStory>;
  return data.hits.filter((h) => /who is hiring/i.test(h.title));
}

async function fetchItem(id: number): Promise<HnItem | null> {
  const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as HnItem;
}

async function fetchTopLevelComments(storyId: number, limit = 200): Promise<HnItem[]> {
  const story = await fetchItem(storyId);
  if (!story?.kids) return [];
  const ids = story.kids.slice(0, limit);
  const items = await Promise.all(ids.map((id) => fetchItem(id)));
  return items.filter((x): x is HnItem => x !== null && x.type === "comment" && !!x.text);
}

export const hnConnector: SourceConnector<HnConfig> = {
  kind: "hn",
  async fetch(config) {
    const stories = await findHiringStories(config.monthsBack ?? 3);
    const allComments = (
      await Promise.all(stories.map((s) => fetchTopLevelComments(Number(s.objectID))))
    ).flat();

    const queryLower = config.query?.toLowerCase();

    const mapped = allComments
      .map<NormalizedPosting | null>((c) => {
        const text = stripHtml(c.text ?? "");
        if (!text) return null;
        if (queryLower && !text.toLowerCase().includes(queryLower)) return null;
        const { company, title } = guessCompanyAndTitle(text);
        const urls = text.match(URL_RE) ?? [];
        const applyUrl = urls[0] ?? `https://news.ycombinator.com/item?id=${c.id}`;
        return {
          externalId: `hn-${c.id}`,
          url: applyUrl,
          title,
          company,
          location: null,
          remote: REMOTE_RE.test(text),
          employmentType: null,
          department: null,
          descriptionHtml: null,
          descriptionText: text,
          postedAt: c.time ? new Date(c.time * 1000) : null,
          raw: { hnId: c.id, parent: c.parent } as Record<string, unknown>,
        };
      })
      .filter((p): p is NormalizedPosting => p !== null);
    return applyIngestFilter(mapped, config);
  },
};
