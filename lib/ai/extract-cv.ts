import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./client";
import { CvDataSchema, type CvData } from "@/lib/cv/schema";

export type ExtractLocale = "fr" | "en";

const SUPPORTED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const SUBMIT_TOOL: Anthropic.Messages.Tool = {
  name: "submit_cv",
  description:
    "Submit the structured CV extracted from the source document. Call this exactly once with the complete extraction.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      header: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          title: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          location: { type: "string" },
          photoUrl: { type: "string", description: "Only if a clearly resolvable URL appears in the source" },
          links: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                href: { type: "string" },
              },
              required: ["label", "href"],
            },
          },
        },
        required: ["name", "title"],
      },
      summary: { type: "string" },
      experiences: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            company: { type: "string" },
            role: { type: "string" },
            startDate: {
              type: "string",
              description: "YYYY or YYYY-MM",
            },
            endDate: {
              type: ["string", "null"],
              description: "YYYY or YYYY-MM, null if current",
            },
            location: { type: "string" },
            summary: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
            stack: { type: "array", items: { type: "string" } },
          },
          required: ["company", "role", "startDate", "endDate"],
        },
      },
      projects: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            url: { type: "string" },
            description: { type: "string" },
            stack: { type: "array", items: { type: "string" } },
          },
          required: ["name", "description"],
        },
      },
      education: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            school: { type: "string" },
            degree: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            location: { type: "string" },
            details: { type: "string" },
          },
          required: ["school", "degree"],
        },
      },
      skills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            category: { type: "string" },
            items: { type: "array", items: { type: "string" }, minItems: 1 },
          },
          required: ["category", "items"],
        },
      },
      languages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            level: { type: "string" },
          },
          required: ["name", "level"],
        },
      },
      certifications: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            issuer: { type: "string" },
            date: { type: "string", description: "YYYY or YYYY-MM" },
            url: { type: "string" },
          },
          required: ["name", "issuer"],
        },
      },
      interests: {
        type: "array",
        items: { type: "string" },
        description: "Short list of personal interests / hobbies, if any.",
      },
    },
    required: ["header"],
  },
};

function systemPrompt(locale: ExtractLocale) {
  return [
    "You are a senior recruiter and career coach. The user has uploaded their existing résumé.",
    "Your mission is to produce a structured CV that shows this candidate at their full potential — confident, senior-grade phrasing, surfacing achievements and scope — WITHOUT inventing anything.",
    "Think of it as the version of the CV the candidate would have written if they didn't suffer from imposter syndrome.",
    "",
    `Write all string content in ${locale === "fr" ? "French" : "English"} (translate if the source is in another language).`,
    "",
    "Framing principles (positive interpretation):",
    "- Adopt the candidate's strongest defensible framing. If the source says 'helped migrate the backend', it's reasonable to say 'contributed to the backend migration'; if it says 'led the migration', say 'led'. Calibrate to the verbs actually used.",
    "- Surface implicit signals that the source mentions in passing: team size, ownership, autonomy, cross-functional collaboration, mentorship, scope (users / requests / revenue) when explicitly named.",
    "- Use confident, action-first verbs: 'designed', 'shipped', 'led', 'scaled', 'owned', 'mentored'. Avoid passive or weak forms ('helped with', 'was involved in', 'participated').",
    "- Drop filler: 'responsible for…', 'worked on…', 'tasked with…'. Merge near-duplicate bullets.",
    "- If the source has no summary (or a weak / generic one), synthesize a tight 2–3 sentence professional summary that positions the candidate at the seniority level the rest of the CV supports.",
    "- Normalize job titles to the locale's conventional senior form when the responsibilities clearly match (e.g. 'Sr. SWE II' → 'Senior Software Engineer'). Do NOT inflate the title beyond what the responsibilities support.",
    "- Infer each experience's technical `stack` from the prose (e.g. 'built REST APIs in Spring Boot' → ['Java', 'Spring Boot', 'REST']).",
    "- Group skills into coherent categories (Languages, Frameworks, Databases, Cloud, Tools, …). Deduplicate.",
    "- Normalize dates strictly to YYYY or YYYY-MM. Use null for endDate when the role is current/ongoing.",
    "- Extract certifications, education details, languages, links/social profiles.",
    "",
    "Hard constraints — the line between confidence and lying:",
    "- NEVER invent employers, schools, job titles, dates, certifications, technologies, or metrics that are not present in the source.",
    "- NEVER fabricate numbers. If the source says 'improved performance', do not write 'improved performance by 40%'. Keep it qualitative.",
    "- NEVER promote someone to a role they didn't hold (no 'engineer' → 'lead engineer' unless the source supports it).",
    "- NEVER drop factual content. You may rephrase, reframe, or merge bullets; you may not omit responsibilities, achievements, or projects that were in the source.",
    "- Omit optional fields only when the source truly has no information about them.",
    "",
    "Output via the submit_cv tool exactly once; do not write any prose response.",
  ].join("\n");
}

function buildSourceBlock(
  mime: string,
  base64: string,
): Anthropic.Messages.ContentBlockParam {
  if (mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mime as "image/png" | "image/jpeg" | "image/webp",
      data: base64,
    },
  };
}

export async function extractCvFromFile(
  file: File,
  locale: ExtractLocale = "fr",
): Promise<CvData> {
  if (!SUPPORTED_MIME.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${file.size} bytes, max ${MAX_BYTES})`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const sourceBlock = buildSourceBlock(file.type, base64);

  const client = getAnthropic();

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const userText =
      attempt === 0
        ? "Extract the CV content into the submit_cv tool."
        : `Your previous output failed validation: ${lastError}. Fix the issues and call submit_cv again.`;

    const response = await client.messages.create({
      model: MODELS.extract,
      max_tokens: 4096,
      system: systemPrompt(locale),
      tools: [SUBMIT_TOOL],
      tool_choice: { type: "tool", name: SUBMIT_TOOL.name },
      messages: [
        {
          role: "user",
          content: [sourceBlock, { type: "text", text: userText }],
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use" && block.name === SUBMIT_TOOL.name,
    );
    if (!toolUse) {
      lastError = "Model did not call submit_cv";
      continue;
    }

    const parsed = CvDataSchema.safeParse(toolUse.input);
    if (parsed.success) return parsed.data;
    lastError = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  }

  throw new Error(`Failed to extract valid CV data: ${lastError}`);
}
