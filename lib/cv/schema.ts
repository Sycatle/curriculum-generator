import { z } from "zod";

const NonEmptyString = z.string().trim().min(1);
const OptionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

// YYYY-MM or YYYY (years allowed for older entries)
const MonthYear = z
  .string()
  .regex(/^\d{4}(-\d{2})?$/, "Expected YYYY or YYYY-MM");

export const LinkSchema = z.object({
  label: NonEmptyString,
  href: z.string().url(),
});
export type Link = z.infer<typeof LinkSchema>;

export const HeaderSchema = z.object({
  name: NonEmptyString,
  title: NonEmptyString,
  email: z.string().email().optional(),
  phone: OptionalString,
  location: OptionalString,
  links: z.array(LinkSchema).default([]),
});
export type Header = z.infer<typeof HeaderSchema>;

export const ExperienceSchema = z.object({
  company: NonEmptyString,
  role: NonEmptyString,
  startDate: MonthYear,
  endDate: MonthYear.nullable(),
  location: OptionalString,
  summary: OptionalString,
  bullets: z.array(NonEmptyString).default([]),
  stack: z.array(NonEmptyString).default([]),
});
export type Experience = z.infer<typeof ExperienceSchema>;

export const ProjectSchema = z.object({
  name: NonEmptyString,
  url: z.string().url().optional(),
  description: NonEmptyString,
  stack: z.array(NonEmptyString).default([]),
});
export type Project = z.infer<typeof ProjectSchema>;

export const EducationSchema = z.object({
  school: NonEmptyString,
  degree: NonEmptyString,
  startDate: MonthYear.optional(),
  endDate: MonthYear.optional(),
  location: OptionalString,
  details: OptionalString,
});
export type Education = z.infer<typeof EducationSchema>;

export const SkillGroupSchema = z.object({
  category: NonEmptyString,
  items: z.array(NonEmptyString).min(1),
});
export type SkillGroup = z.infer<typeof SkillGroupSchema>;

export const LanguageSchema = z.object({
  name: NonEmptyString,
  level: NonEmptyString, // e.g. "Native", "C1"
});
export type Language = z.infer<typeof LanguageSchema>;

export const CertificationSchema = z.object({
  name: NonEmptyString,
  issuer: NonEmptyString,
  date: MonthYear.optional(),
  url: z.string().url().optional(),
});
export type Certification = z.infer<typeof CertificationSchema>;

export const CvDataSchema = z.object({
  header: HeaderSchema,
  photoUrl: z.string().url().optional(),
  summary: OptionalString,
  experiences: z.array(ExperienceSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(SkillGroupSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  interests: z.array(NonEmptyString).default([]),
});
export type CvData = z.infer<typeof CvDataSchema>;

// ----- Theme (design tokens) -----

export const ThemeSchema = z.object({
  template: z.enum(["modern", "ats", "premium"]).default("premium"),
  pageMode: z.enum(["single", "multi"]).default("single"),
  colors: z.object({
    primary: z.string(),
    text: z.string(),
    muted: z.string(),
    accent: z.string(),
  }),
  fonts: z.object({
    heading: z.enum(["sans", "serif", "mono"]),
    body: z.enum(["sans", "serif", "mono"]),
  }),
  spacing: z.enum(["compact", "normal", "airy"]),
  accentStyle: z.enum(["bar", "underline", "none"]),
});
export type Theme = z.infer<typeof ThemeSchema>;

// ----- CV input (creation/update payload) -----

export const SlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Slug must be kebab-case alphanumeric");

export const CvInputSchema = z.object({
  title: NonEmptyString.max(120),
  slug: SlugSchema,
  locale: z.enum(["fr", "en"]).default("fr"),
  data: CvDataSchema,
  theme: ThemeSchema,
  isPublic: z.boolean().default(false),
});
export type CvInput = z.infer<typeof CvInputSchema>;
