import type { Theme } from "@/lib/cv/schema";

export type ResolvedTokens = {
  colors: Theme["colors"] & { surface: string; pill: string };
  fonts: { heading: string; body: string };
  spacing: {
    pageX: number;
    pageY: number;
    section: number;
    item: number;
    line: number;
    gutter: number;
  };
  fontSize: {
    name: number;
    role: number;
    sectionLabel: number;
    itemTitle: number;
    body: number;
    small: number;
    micro: number;
  };
  layout: { sidebarRatio: number };
  accent: Theme["accentStyle"];
};

export type SpacingTier = Theme["spacing"] | "ultracompact";

export type TokenOverrides = {
  /** Force a spacing tier regardless of theme.spacing. */
  spacingTier?: SpacingTier;
  /** Multiplier applied to every fontSize.*. Capped so body >= 7.5. */
  fontScale?: number;
  /** Slice oldest experiences past this count. */
  maxExperiences?: number;
  /** Slice trailing bullets past this count per experience. */
  maxBulletsPerExp?: number;
};

const FONT_MAP: Record<Theme["fonts"]["body"], string> = {
  sans: "Inter",
  serif: "Times-Roman",
  mono: "Courier",
};

const SPACING_MAP: Record<
  SpacingTier,
  Pick<ResolvedTokens["spacing"], "pageX" | "pageY" | "section" | "item" | "line" | "gutter">
> = {
  ultracompact: { pageX: 20, pageY: 18, section: 6, item: 3, line: 1.2, gutter: 12 },
  compact: { pageX: 24, pageY: 22, section: 8, item: 5, line: 1.25, gutter: 14 },
  normal: { pageX: 28, pageY: 26, section: 12, item: 7, line: 1.3, gutter: 16 },
  airy: { pageX: 36, pageY: 32, section: 16, item: 10, line: 1.4, gutter: 20 },
};

const BASE_FONT_SIZE: ResolvedTokens["fontSize"] = {
  name: 22,
  role: 11,
  sectionLabel: 8.5,
  itemTitle: 9.5,
  body: 8.5,
  small: 8,
  micro: 7,
};

const MIN_BODY = 7.5;

function withAlpha(hex: string, alpha: number) {
  const v = hex.replace("#", "");
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${v}${a}`;
}

function scaledFontSize(scale: number): ResolvedTokens["fontSize"] {
  // Ensure body never drops below MIN_BODY by raising the effective scale.
  const effective = Math.max(scale, MIN_BODY / BASE_FONT_SIZE.body);
  return {
    name: BASE_FONT_SIZE.name * effective,
    role: BASE_FONT_SIZE.role * effective,
    sectionLabel: BASE_FONT_SIZE.sectionLabel * effective,
    itemTitle: BASE_FONT_SIZE.itemTitle * effective,
    body: BASE_FONT_SIZE.body * effective,
    small: BASE_FONT_SIZE.small * effective,
    micro: BASE_FONT_SIZE.micro * effective,
  };
}

export function resolveTokens(theme: Theme, overrides?: TokenOverrides): ResolvedTokens {
  const tier: SpacingTier = overrides?.spacingTier ?? theme.spacing;
  const scale = overrides?.fontScale ?? 1;
  return {
    colors: {
      ...theme.colors,
      surface: withAlpha(theme.colors.accent, 0.08),
      pill: withAlpha(theme.colors.accent, 0.12),
    },
    fonts: {
      heading: FONT_MAP[theme.fonts.heading],
      body: FONT_MAP[theme.fonts.body],
    },
    spacing: SPACING_MAP[tier],
    fontSize: scale === 1 ? { ...BASE_FONT_SIZE } : scaledFontSize(scale),
    layout: { sidebarRatio: 0.36 },
    accent: theme.accentStyle,
  };
}

/**
 * Apply truncation overrides to a CvData payload. Returns the same shape so
 * templates don't need to know whether truncation happened.
 */
export function applyTruncation<T extends { experiences: ReadonlyArray<{ bullets: string[] }> }>(
  data: T,
  overrides?: Pick<TokenOverrides, "maxExperiences" | "maxBulletsPerExp">,
): T {
  if (!overrides) return data;
  const { maxExperiences, maxBulletsPerExp } = overrides;
  if (maxExperiences == null && maxBulletsPerExp == null) return data;

  const sliced = (maxExperiences == null
    ? data.experiences
    : data.experiences.slice(0, maxExperiences)
  ).map((exp) =>
    maxBulletsPerExp == null
      ? exp
      : { ...exp, bullets: exp.bullets.slice(0, maxBulletsPerExp) },
  );
  return { ...data, experiences: sliced };
}
