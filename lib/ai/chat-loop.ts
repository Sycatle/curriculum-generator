import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./client";
import {
  findTool,
  PROPOSE_TOOL_NAME,
  toolsForAnthropic,
  type ToolResult,
} from "./tools";
import type { CvData } from "@/lib/cv/schema";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_TOOL_CALLS = 10;
const MAX_USER_MESSAGES = 20;

function systemPrompt(locale: string, cv: CvData) {
  return [
    "You are an AI career coach embedded in a CV editor. The user is improving their résumé.",
    "Your mission is to show this candidate at their full potential — confident, senior-grade phrasing, surfacing achievements and scope — WITHOUT inventing anything.",
    "Think of it as the version of the CV the candidate would have written if they didn't suffer from imposter syndrome.",
    "",
    `Reply in the same language as the user (CV locale is ${locale}).`,
    "Always call tools rather than describing edits in prose.",
    "Before `propose_changes`, ALWAYS call `check_cv_length` once. If it reports irreducible overflow, cut content (drop the oldest experience or weakest bullets) and re-check before proposing. The single-A4-page guarantee is non-negotiable — silently compressed content is worse than nothing.",
    "When all requested changes are applied and `check_cv_length` is green, call `propose_changes` with a one-sentence summary.",
    "",
    "Framing principles (positive interpretation):",
    "- Adopt the candidate's strongest defensible framing. Calibrate confidence to the verbs and signals already in the CV.",
    "- Surface implicit scope (team size, autonomy, ownership, cross-functional collaboration) when it's mentioned in passing.",
    "- Use confident, action-first verbs: 'designed', 'shipped', 'led', 'scaled', 'owned', 'mentored'. Drop weak forms ('helped with', 'was involved in').",
    "- Keep bullets concise: verb-first, one idea per bullet, quantified ONLY when the user actually provided a number.",
    "",
    "Hard constraints — the line between confidence and lying:",
    "- NEVER invent employers, dates, titles, technologies, certifications, or numbers the user hasn't supplied.",
    "- If the user asks you to quantify something and no number exists in the CV or in their message, ask a clarifying question instead of fabricating one.",
    "- NEVER promote someone to a role they didn't hold.",
    "- Don't drop factual content the user has written; rephrase and reframe, don't erase.",
    "",
    describeCv(cv),
  ].join("\n");
}

function describeCv(cv: CvData): string {
  const expSummary = cv.experiences
    .map((e, i) => `  [${i}] ${e.role} @ ${e.company} (${e.startDate} → ${e.endDate ?? "present"}) — ${e.bullets.length} bullets`)
    .join("\n");
  return [
    `# Current CV state`,
    `Name: ${cv.header.name} — ${cv.header.title}`,
    cv.summary ? `Summary: ${cv.summary}` : "Summary: (empty)",
    `Experiences:\n${expSummary || "  (none)"}`,
    `Skills: ${cv.skills.map((s) => s.category).join(", ") || "(none)"}`,
    `Languages: ${cv.languages.map((l) => `${l.name} (${l.level})`).join(", ") || "(none)"}`,
  ].join("\n");
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; summary: string; ok: boolean; error?: string }
  | { type: "done"; finalData: CvData; summary: string }
  | { type: "error"; error: string };

export async function* runChatStream(args: {
  cvData: CvData;
  locale: string;
  messages: ChatMessage[];
}): AsyncGenerator<StreamEvent> {
  const anthropic = getAnthropic();
  let current: CvData = args.cvData;
  let proposeSummary = "Changes applied.";

  const userHistory = args.messages.slice(-MAX_USER_MESSAGES);
  if (userHistory.length === 0 || userHistory[0]?.role !== "user") {
    yield { type: "error", error: "First message must be from user" };
    return;
  }
  const apiMessages: Anthropic.Messages.MessageParam[] = userHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let toolCalls = 0;
  let proposed = false;

  while (!proposed) {
    if (toolCalls >= MAX_TOOL_CALLS) {
      yield { type: "error", error: "Tool call limit reached" };
      return;
    }

    const response = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 2048,
      system: systemPrompt(args.locale, current),
      tools: toolsForAnthropic(),
      messages: apiMessages,
    });

    // Emit assistant text blocks first
    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        yield { type: "text", delta: block.text };
      }
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0) {
      // Model stopped without proposing — treat as done with no changes
      yield { type: "done", finalData: current, summary: "No changes." };
      return;
    }

    // Push the assistant turn into history
    apiMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const use of toolUses) {
      toolCalls++;
      if (use.name === PROPOSE_TOOL_NAME) {
        proposed = true;
        const summary =
          (use.input as { summary?: string } | null)?.summary ?? "Changes applied.";
        proposeSummary = summary;
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: "ok",
        });
        continue;
      }
      const tool = findTool(use.name);
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: `Unknown tool: ${use.name}`,
          is_error: true,
        });
        yield {
          type: "tool_call",
          name: use.name,
          summary: `Unknown tool: ${use.name}`,
          ok: false,
          error: "Unknown tool",
        };
        continue;
      }
      const result: ToolResult = await tool.run(current, use.input);
      if (result.ok) {
        current = result.next;
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: result.summary,
        });
        yield { type: "tool_call", name: use.name, summary: result.summary, ok: true };
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: result.error,
          is_error: true,
        });
        yield {
          type: "tool_call",
          name: use.name,
          summary: result.error,
          ok: false,
          error: result.error,
        };
      }
    }

    if (proposed) break;

    apiMessages.push({ role: "user", content: toolResults });

    if (response.stop_reason === "end_turn" && toolUses.length === 0) {
      break;
    }
  }

  yield { type: "done", finalData: current, summary: proposeSummary };
}
