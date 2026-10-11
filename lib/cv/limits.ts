/**
 * UI-side soft/hard caps on CV content. They DO NOT enforce anything at the
 * schema level — the auto-fit cascade is the only mechanism that guarantees a
 * single page. These limits give the user early visual signal that the content
 * will be aggressively compressed (or truncated) if pushed further.
 *
 * - `soft`: show a warning, still allow the input
 * - `hard`: visually block adding more (button disabled), still doesn't reject saved CVs
 */
export const LIMITS = {
  bulletsPerExperience: { soft: 5, hard: 8 },
  experiences: { soft: 5, hard: 10 },
  summaryChars: { soft: 280, hard: 400 },
  bulletChars: { soft: 140, hard: 200 },
} as const;

export type LimitKey = keyof typeof LIMITS;

export type LimitLevel = "ok" | "soft" | "hard";

export function levelFor(value: number, key: LimitKey): LimitLevel {
  const { soft, hard } = LIMITS[key];
  if (value >= hard) return "hard";
  if (value >= soft) return "soft";
  return "ok";
}
