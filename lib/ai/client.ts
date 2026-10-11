import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

export const MODELS = {
  extract: "claude-opus-4-7",
  chat: "claude-sonnet-4-6",
  cheap: "claude-haiku-4-5-20251001",
} as const;
