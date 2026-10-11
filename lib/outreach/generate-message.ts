/**
 * Generate a personalised cold-outreach message (subject + body) for one
 * (CV, company, contact) triple using Claude Sonnet.
 *
 * Prompt caching:
 *   - System prompt (instructions + style guide) → cached
 *   - CV payload → cached (per user, switches with CV)
 *   - Company/contact → uncached (varies per call)
 *
 * Output: structured JSON via tool use, so we never have to parse markdown.
 * The body is markdown (kept short, 80-120 words) and ends with a footer
 * containing the disclosure + opt-out URL.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "@/lib/ai/client";
import type { CvData } from "@/lib/cv/schema";

export type OutreachLang = "fr" | "en";

export interface CompanyContext {
  name: string;
  domain: string | null;
  city: string | null;
  country: string | null;
  activityLabel: string | null;
  headcount: string | null;
}

export interface ContactContext {
  email: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  emailKind: "generic" | "nominative";
}

export interface GeneratedMessage {
  subject: string;
  bodyMarkdown: string;
  reason: string; // explanation why this company was contacted (used in disclosure)
}

const SYSTEM_FR = `Tu rédiges des emails de candidature spontanée B2B, courts et concrets.
Règles strictes :
- 80-120 mots maximum dans le corps (hors signature/footer).
- Aucun « copier-coller » : tu mentionnes UNE chose précise sur l'entreprise (activité, taille, ville, secteur) et tu fais le lien explicite avec UNE expérience pertinente du candidat.
- Pas de superlatifs ("incroyable", "passionné par"...). Ton direct, sobre, professionnel.
- Pas de "j'espère que ce message vous trouve bien" ni autres formules creuses.
- Objet ≤ 60 caractères, sans clickbait, sans emoji. Si destinataire générique (careers@...), pas de "Bonjour [Prénom]" — utiliser "Bonjour" tout court.
- Termine le corps par UNE proposition concrète : un échange court (15 min) ou l'envoi de précisions.
- Réponds via le tool 'submit_message'. Réponds en français.`;

const SYSTEM_EN = `You write short, concrete B2B spontaneous-application emails.
Strict rules:
- 80-120 words maximum in the body (excluding signature/footer).
- No copy-paste: mention ONE specific thing about the company (activity, size, city, sector) and tie it explicitly to ONE relevant experience from the candidate.
- No fluff ("I'm passionate about...", "I'm excited to..."). Direct, sober, professional tone.
- No "I hope this finds you well" or similar empty formulas.
- Subject line ≤ 60 chars, no clickbait, no emoji. If recipient is generic (careers@...), no "Hi [Name]" — use plain "Hello".
- End the body with ONE concrete proposal: a short chat (15 min) or sending more details.
- Reply via the 'submit_message' tool. Reply in English.`;

const SUBMIT_TOOL: Anthropic.Messages.Tool = {
  name: "submit_message",
  description: "Submit the generated subject + body markdown for this outreach message.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      subject: { type: "string", minLength: 1, maxLength: 80 },
      bodyMarkdown: { type: "string", minLength: 50 },
      reason: {
        type: "string",
        description:
          "One sentence stating WHY this company is being contacted, in the message language (will be reused in the disclosure footer).",
        minLength: 5,
        maxLength: 200,
      },
    },
    required: ["subject", "bodyMarkdown", "reason"],
  },
};

function summarizeCv(cv: CvData): string {
  const exp = cv.experiences
    .slice(0, 4)
    .map(
      (e) =>
        `- ${e.role} @ ${e.company} (${e.startDate}–${e.endDate ?? "now"}) — ${e.summary ?? ""}\n  Stack: ${(e.stack ?? []).join(", ")}`,
    )
    .join("\n");
  const skills = (cv.skills ?? [])
    .flatMap((g) => g.items)
    .slice(0, 16)
    .join(", ");
  return `Candidate: ${cv.header.name} — ${cv.header.title}
Location: ${cv.header.location ?? "—"}
Top skills: ${skills}
Recent experiences:
${exp}`;
}

function summarizeCompany(c: CompanyContext): string {
  return [
    `Company: ${c.name}`,
    c.domain ? `Domain: ${c.domain}` : null,
    c.city || c.country
      ? `Location: ${[c.city, c.country].filter(Boolean).join(", ")}`
      : null,
    c.activityLabel ? `Activity: ${c.activityLabel}` : null,
    c.headcount ? `Headcount: ${c.headcount}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeContact(c: ContactContext): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || null;
  return [
    `Email: ${c.email}`,
    `Kind: ${c.emailKind}`,
    name ? `Name: ${name}` : null,
    c.title ? `Title: ${c.title}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateOutreachMessage(params: {
  cv: CvData;
  company: CompanyContext;
  contact: ContactContext;
  lang: OutreachLang;
}): Promise<GeneratedMessage> {
  const { cv, company, contact, lang } = params;
  const anthropic = getAnthropic();

  const system: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: lang === "fr" ? SYSTEM_FR : SYSTEM_EN,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `=== Candidate profile ===\n${summarizeCv(cv)}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  const userMsg = `=== Company ===\n${summarizeCompany(company)}\n\n=== Recipient ===\n${summarizeContact(contact)}\n\nWrite the outreach message via the submit_message tool.`;

  const resp = await anthropic.messages.create({
    model: MODELS.chat,
    max_tokens: 800,
    system,
    tools: [SUBMIT_TOOL],
    tool_choice: { type: "tool", name: "submit_message" },
    messages: [{ role: "user", content: userMsg }],
  });

  for (const block of resp.content) {
    if (block.type === "tool_use" && block.name === "submit_message") {
      const input = block.input as {
        subject?: unknown;
        bodyMarkdown?: unknown;
        reason?: unknown;
      };
      if (
        typeof input.subject === "string" &&
        typeof input.bodyMarkdown === "string" &&
        typeof input.reason === "string"
      ) {
        return {
          subject: input.subject.trim(),
          bodyMarkdown: input.bodyMarkdown.trim(),
          reason: input.reason.trim(),
        };
      }
    }
  }
  throw new Error("Claude did not return a valid submit_message tool call");
}
