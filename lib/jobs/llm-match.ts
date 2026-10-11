/**
 * LLM-based posting ↔ profile matcher.
 *
 * Reads the job description (often where employers hide the real seniority,
 * remote policy, salary and dealbreakers) and produces a structured verdict
 * blended on top of the deterministic `matchPostingMulti` score.
 *
 * Cost-aware: uses Anthropic prompt caching to share the system prompt + the
 * user's targeting profile + CV summary across N postings in a single batch.
 * First call writes the cache, calls 2..N pay ~10× less for the shared prefix.
 *
 * Defaults to Haiku 4.5 (env `JOBS_LLM_MODEL` overrides). Failure mode is
 * graceful: returns null per posting so the caller falls back to deterministic.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "@/lib/ai/client";
import type { JobPostingRecord } from "./repository";
import type { TargetingProfile } from "./targeting";

export type LlmVerdict = "fit" | "stretch" | "mismatch";

export interface LlmExtractedSignals {
  actualSeniority: "junior" | "mid" | "senior" | "lead" | "staff" | "unknown";
  remotePolicy: "onsite" | "hybrid" | "full-remote" | "unknown";
  languagesRequired: string[];
  realSalaryMinEUR: number | null;
  realSalaryMaxEUR: number | null;
  mainStack: string[];
  isAlternance: boolean;
  dealbreakers: string[];
}

export interface LlmMatchResult {
  score: number; // 0-100
  verdict: LlmVerdict;
  reasons: string[];
  extracted: LlmExtractedSignals;
  usage: { inputTokens: number; cachedTokens: number; outputTokens: number };
  model: string;
}

const TOOL: Anthropic.Tool = {
  name: "report_match",
  description:
    "Report a structured fit verdict between a candidate's CV+targeting profile and a single job posting. Read the description carefully — French employers often bury the real seniority, remote policy, salary, and dealbreakers in the free text rather than the structured fields.",
  input_schema: {
    type: "object",
    required: ["score", "verdict", "reasons", "extracted"],
    properties: {
      score: { type: "integer", minimum: 0, maximum: 100 },
      verdict: { type: "string", enum: ["fit", "stretch", "mismatch"] },
      reasons: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
        description: "2-5 short bullets explaining the verdict.",
      },
      extracted: {
        type: "object",
        required: [
          "actualSeniority",
          "remotePolicy",
          "languagesRequired",
          "realSalaryMinEUR",
          "realSalaryMaxEUR",
          "mainStack",
          "isAlternance",
          "dealbreakers",
        ],
        properties: {
          actualSeniority: {
            type: "string",
            enum: ["junior", "mid", "senior", "lead", "staff", "unknown"],
          },
          remotePolicy: {
            type: "string",
            enum: ["onsite", "hybrid", "full-remote", "unknown"],
          },
          languagesRequired: { type: "array", items: { type: "string" } },
          realSalaryMinEUR: { type: ["integer", "null"] },
          realSalaryMaxEUR: { type: ["integer", "null"] },
          mainStack: { type: "array", items: { type: "string" } },
          isAlternance: { type: "boolean" },
          dealbreakers: {
            type: "array",
            items: { type: "string" },
            description:
              "Hard constraints in the JD that would disqualify this candidate (ex: exact years required, mandatory onsite, exclusive tech they don't have).",
          },
        },
      },
    },
  },
} as Anthropic.Tool;

const SYSTEM_PROMPT = `You are a job-posting fit classifier. You compare a candidate (CV + targeting profile) against a single job posting and produce a structured verdict via the report_match tool.

Hard rules:
- The job description is the ground truth; structured fields may be wrong or absent.
- Extract the *real* seniority required, remote policy, languages, salary range, and dealbreakers from the description text.
- Verdict 'fit' means clearly aligned with the candidate's profile and CV.
- Verdict 'stretch' means partial match (e.g. close on stack but slightly off on seniority or location).
- Verdict 'mismatch' means at least one dealbreaker present (e.g. requires a tech the candidate explicitly excludes, location they can't accept, contract type they don't want).
- Reasons must be short and specific, in the same language as the JD when possible.
- If a salary range is stated in the JD, normalize to annual EUR; otherwise leave null.
- isAlternance is true ONLY when the posting is for an apprenticeship/work-study contract.

Always call the report_match tool. Never reply in free text.`;

function trimDescription(text: string | null | undefined, max = 6000): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function compactProfile(profile: TargetingProfile): Record<string, unknown> {
  return {
    targetRoles: profile.targetRoles,
    mustHaveSkills: profile.mustHaveSkills,
    niceSkills: profile.niceSkills,
    excludeKeywords: profile.excludeKeywords,
    targetLocations: profile.targetLocations,
    excludeCompanies: profile.excludeCompanies,
    remoteRequired: profile.remoteRequired,
    seniorityMin: profile.seniorityMin,
    seniorityMax: profile.seniorityMax,
    languages: profile.languages,
    employmentTypes: profile.employmentTypes,
    salaryMinEUR: profile.salaryMinEUR,
    excludeAlternance: profile.excludeAlternance,
  };
}

function compactPosting(p: JobPostingRecord): Record<string, unknown> {
  return {
    title: p.title,
    company: p.company,
    location: p.location,
    remote: p.remote,
    employmentType: p.employmentType,
    department: p.department,
    isAlternance: p.isAlternance,
    salaryMinEUR: p.salaryMinEUR,
    salaryMaxEUR: p.salaryMaxEUR,
    salaryPeriod: p.salaryPeriod,
    salaryRaw: p.salaryRaw,
    experienceLabel: p.experienceLabel,
    experienceRequiredMonths: p.experienceRequiredMonths,
    appellationLibelle: p.appellationLibelle,
    romeCode: p.romeCode,
    workContext: p.workContext,
    description: trimDescription(p.descriptionText ?? p.descriptionHtml),
  };
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && "status" in err) {
    const status = (err as { status?: number }).status;
    if (status === 429) return true;
    if (typeof status === "number" && status >= 500) return true;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface LlmMatchBatchOptions {
  model?: string;
  concurrency?: number;
  signal?: AbortSignal;
}

interface RunOneArgs {
  posting: JobPostingRecord;
  profileBlock: string;
  cvBlock: string;
  model: string;
  signal?: AbortSignal;
}

async function runOne(args: RunOneArgs): Promise<LlmMatchResult | null> {
  const client = getAnthropic();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: args.model,
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `<profile>\n${args.profileBlock}\n</profile>\n\n<cv>\n${args.cvBlock}\n</cv>`,
                cache_control: { type: "ephemeral" },
              },
              {
                type: "text",
                text: `<posting>\n${JSON.stringify(compactPosting(args.posting), null, 2)}\n</posting>`,
              },
            ],
          },
        ],
      });

      const tool = response.content.find(
        (b): b is Anthropic.Messages.ToolUseBlock =>
          b.type === "tool_use" && b.name === TOOL.name,
      );
      if (!tool) {
        lastError = new Error("Model did not call report_match");
        continue;
      }
      const input = tool.input as {
        score: number;
        verdict: LlmVerdict;
        reasons: string[];
        extracted: LlmExtractedSignals;
      };

      // Defensive: clamp score, ensure arrays.
      const score = Math.max(0, Math.min(100, Math.round(Number(input.score ?? 0))));
      const verdict: LlmVerdict =
        input.verdict === "fit" || input.verdict === "stretch" || input.verdict === "mismatch"
          ? input.verdict
          : "stretch";
      const usage = response.usage as Anthropic.Messages.Usage & {
        cache_read_input_tokens?: number;
      };
      return {
        score,
        verdict,
        reasons: Array.isArray(input.reasons) ? input.reasons.slice(0, 5) : [],
        extracted: input.extracted,
        usage: {
          inputTokens: usage.input_tokens ?? 0,
          cachedTokens: usage.cache_read_input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
        },
        model: args.model,
      };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === 2) break;
      await sleep(500 * Math.pow(3, attempt));
    }
  }
  if (lastError) {
    console.warn(
      `[llm-match] posting ${args.posting.id} failed:`,
      lastError instanceof Error ? lastError.message : String(lastError),
    );
  }
  return null;
}

/**
 * Run LLM matching over a batch of postings with limited concurrency.
 * Returns Map<postingId, result>; failed postings are absent from the map.
 */
export async function llmMatchBatch(
  postings: JobPostingRecord[],
  shared: { profile: TargetingProfile; cvSummary: string },
  opts: LlmMatchBatchOptions = {},
): Promise<Map<string, LlmMatchResult>> {
  const out = new Map<string, LlmMatchResult>();
  if (postings.length === 0) return out;

  const model = opts.model ?? process.env.JOBS_LLM_MODEL ?? MODELS.cheap;
  const concurrency = Math.max(1, Math.min(10, opts.concurrency ?? 5));

  const profileBlock = JSON.stringify(compactProfile(shared.profile), null, 2);
  const cvBlock = shared.cvSummary;

  const queue = [...postings];
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      if (opts.signal?.aborted) return;
      const p = queue.shift();
      if (!p) return;
      const res = await runOne({ posting: p, profileBlock, cvBlock, model, signal: opts.signal });
      if (res) out.set(p.id, res);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, postings.length) }, () => worker());
  await Promise.all(workers);
  return out;
}
