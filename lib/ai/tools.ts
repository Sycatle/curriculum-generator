import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import {
  CvDataSchema,
  EducationSchema,
  ExperienceSchema,
  LanguageSchema,
  ProjectSchema,
  SkillGroupSchema,
  type CvData,
} from "@/lib/cv/schema";
import { defaultTheme } from "@/lib/cv/defaults";
import { renderCvFitted } from "@/lib/pdf/fit";
import { countPdfPages } from "@/lib/pdf/measure";

export type ToolResult = { ok: true; next: CvData; summary: string } | { ok: false; error: string };
type ToolResultOrPromise = ToolResult | Promise<ToolResult>;

type Executor<I> = (current: CvData, input: I) => ToolResultOrPromise;

function safe<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  run: (input: z.infer<S>) => ToolResultOrPromise,
): ToolResultOrPromise {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tool input" };
  }
  return run(parsed.data);
}

// ---------- Tool input schemas ----------

const RewriteBulletInput = z.object({
  experienceIndex: z.number().int().min(0),
  bulletIndex: z.number().int().min(0),
  newBullet: z.string().trim().min(1),
});

const RewriteSummaryInput = z.object({
  newSummary: z.string().trim().min(1),
});

const AddExperienceInput = z.object({
  experience: ExperienceSchema,
  position: z.enum(["start", "end"]).default("start"),
});

const UpdateExperienceInput = z.object({
  index: z.number().int().min(0),
  patch: ExperienceSchema.partial(),
});

const RemoveExperienceInput = z.object({
  index: z.number().int().min(0),
});

const ReorderBulletsInput = z.object({
  experienceIndex: z.number().int().min(0),
  order: z.array(z.number().int().min(0)),
});

const AddSkillGroupInput = z.object({
  group: SkillGroupSchema,
});

const AddSkillItemInput = z.object({
  category: z.string().trim().min(1),
  item: z.string().trim().min(1),
});

const AddProjectInput = z.object({
  project: ProjectSchema,
});

const AddEducationInput = z.object({
  education: EducationSchema,
});

const AddLanguageInput = z.object({
  language: LanguageSchema,
});

const SetHeaderInput = z.object({
  patch: z
    .object({
      name: z.string().trim().min(1).optional(),
      title: z.string().trim().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().trim().optional(),
      location: z.string().trim().optional(),
    })
    .strict(),
});

const ProposeChangesInput = z.object({
  summary: z.string().trim().min(1),
});

const CheckCvLengthInput = z.object({}).strict();

const TailorForJobInput = z.object({
  jobDescription: z.string().trim().min(50, "Job description must be at least 50 chars"),
});

// ---------- Executors ----------

const rewriteBullet: Executor<z.infer<typeof RewriteBulletInput>> = (current, input) => {
  const exp = current.experiences[input.experienceIndex];
  if (!exp) return { ok: false, error: `No experience at index ${input.experienceIndex}` };
  if (input.bulletIndex >= exp.bullets.length) {
    return { ok: false, error: `No bullet at index ${input.bulletIndex}` };
  }
  const bullets = [...exp.bullets];
  bullets[input.bulletIndex] = input.newBullet;
  const experiences = [...current.experiences];
  experiences[input.experienceIndex] = { ...exp, bullets };
  return {
    ok: true,
    next: { ...current, experiences },
    summary: `Rewrote bullet ${input.bulletIndex + 1} of "${exp.role} @ ${exp.company}"`,
  };
};

const rewriteSummary: Executor<z.infer<typeof RewriteSummaryInput>> = (current, input) => ({
  ok: true,
  next: { ...current, summary: input.newSummary },
  summary: "Rewrote profile summary",
});

const addExperience: Executor<z.infer<typeof AddExperienceInput>> = (current, input) => {
  const experiences =
    input.position === "start"
      ? [input.experience, ...current.experiences]
      : [...current.experiences, input.experience];
  return {
    ok: true,
    next: { ...current, experiences },
    summary: `Added experience "${input.experience.role} @ ${input.experience.company}"`,
  };
};

const updateExperience: Executor<z.infer<typeof UpdateExperienceInput>> = (current, input) => {
  const exp = current.experiences[input.index];
  if (!exp) return { ok: false, error: `No experience at index ${input.index}` };
  const merged = ExperienceSchema.safeParse({ ...exp, ...input.patch });
  if (!merged.success) {
    return { ok: false, error: merged.error.issues[0]?.message ?? "Invalid patch" };
  }
  const experiences = [...current.experiences];
  experiences[input.index] = merged.data;
  return {
    ok: true,
    next: { ...current, experiences },
    summary: `Updated experience "${merged.data.role} @ ${merged.data.company}"`,
  };
};

const removeExperience: Executor<z.infer<typeof RemoveExperienceInput>> = (current, input) => {
  const exp = current.experiences[input.index];
  if (!exp) return { ok: false, error: `No experience at index ${input.index}` };
  const experiences = current.experiences.filter((_, i) => i !== input.index);
  return {
    ok: true,
    next: { ...current, experiences },
    summary: `Removed experience "${exp.role} @ ${exp.company}"`,
  };
};

const reorderBullets: Executor<z.infer<typeof ReorderBulletsInput>> = (current, input) => {
  const exp = current.experiences[input.experienceIndex];
  if (!exp) return { ok: false, error: `No experience at index ${input.experienceIndex}` };
  if (
    input.order.length !== exp.bullets.length ||
    new Set(input.order).size !== exp.bullets.length ||
    input.order.some((i) => i < 0 || i >= exp.bullets.length)
  ) {
    return { ok: false, error: "order must be a permutation of existing bullet indices" };
  }
  const bullets = input.order.map((i) => exp.bullets[i]!);
  const experiences = [...current.experiences];
  experiences[input.experienceIndex] = { ...exp, bullets };
  return {
    ok: true,
    next: { ...current, experiences },
    summary: `Reordered bullets of "${exp.role} @ ${exp.company}"`,
  };
};

const addSkillGroup: Executor<z.infer<typeof AddSkillGroupInput>> = (current, input) => ({
  ok: true,
  next: { ...current, skills: [...current.skills, input.group] },
  summary: `Added skill group "${input.group.category}"`,
});

const addSkillItem: Executor<z.infer<typeof AddSkillItemInput>> = (current, input) => {
  const idx = current.skills.findIndex(
    (g) => g.category.toLowerCase() === input.category.toLowerCase(),
  );
  if (idx === -1) {
    return {
      ok: true,
      next: {
        ...current,
        skills: [...current.skills, { category: input.category, items: [input.item] }],
      },
      summary: `Created group "${input.category}" with "${input.item}"`,
    };
  }
  const group = current.skills[idx]!;
  if (group.items.some((it) => it.toLowerCase() === input.item.toLowerCase())) {
    return { ok: false, error: `"${input.item}" already in "${group.category}"` };
  }
  const skills = [...current.skills];
  skills[idx] = { ...group, items: [...group.items, input.item] };
  return {
    ok: true,
    next: { ...current, skills },
    summary: `Added skill "${input.item}" to "${group.category}"`,
  };
};

const addProject: Executor<z.infer<typeof AddProjectInput>> = (current, input) => ({
  ok: true,
  next: { ...current, projects: [...current.projects, input.project] },
  summary: `Added project "${input.project.name}"`,
});

const addEducation: Executor<z.infer<typeof AddEducationInput>> = (current, input) => ({
  ok: true,
  next: { ...current, education: [...current.education, input.education] },
  summary: `Added education "${input.education.degree} @ ${input.education.school}"`,
});

const addLanguage: Executor<z.infer<typeof AddLanguageInput>> = (current, input) => ({
  ok: true,
  next: { ...current, languages: [...current.languages, input.language] },
  summary: `Added language "${input.language.name}" (${input.language.level})`,
});

const setHeader: Executor<z.infer<typeof SetHeaderInput>> = (current, input) => {
  const merged = { ...current.header, ...input.patch };
  return {
    ok: true,
    next: { ...current, header: merged },
    summary: `Updated header fields: ${Object.keys(input.patch).join(", ")}`,
  };
};

const tailorForJob: Executor<z.infer<typeof TailorForJobInput>> = async (current, input) => {
  const { extractJobKeywords, matchKeywords } = await import("@/lib/cv/job-match");
  const keywords = extractJobKeywords(input.jobDescription);
  const result = matchKeywords(current, keywords);
  const mustGaps = result.gaps.filter((g) => g.category === "must-have").map((g) => g.term);
  const niceGaps = result.gaps.filter((g) => g.category === "nice-to-have").map((g) => g.term);
  const present = result.matches.filter((m) => m.status !== "missing").map((m) => m.keyword.term);
  const summary = [
    `Coverage must-have: ${result.coverage}%.`,
    `Present (${present.length}): ${present.slice(0, 12).join(", ") || "—"}.`,
    `Missing must-have (${mustGaps.length}): ${mustGaps.join(", ") || "—"}.`,
    `Missing nice-to-have (${niceGaps.length}): ${niceGaps.slice(0, 8).join(", ") || "—"}.`,
    "Use rewrite_bullet / add_skill_item to weave missing must-haves into the CV.",
  ].join(" ");
  return { ok: true, next: current, summary };
};

const checkCvLength: Executor<z.infer<typeof CheckCvLengthInput>> = async (current) => {
  const naturalPages = await countPdfPages(current, defaultTheme);
  if (naturalPages <= 1) {
    return { ok: true, next: current, summary: "Fits on 1 A4 page at default density. No compression needed." };
  }
  const fit = await renderCvFitted(current, defaultTheme);
  if (!fit.overflowed) {
    return {
      ok: true,
      next: current,
      summary: `Natural render = ${naturalPages} pages. Multi-page export preserves all content; one-page export can auto-fit with compression pass ${fit.pass}.`,
    };
  }
  return {
    ok: true,
    next: current,
    summary: `Natural render = ${naturalPages} pages. Multi-page export preserves all content. One-page export would still clip after maximum compression; trim the weakest material only if a one-page version is required.`,
  };
};

// ---------- Anthropic tool definitions ----------

function zodTool<S extends z.ZodTypeAny>(
  name: string,
  description: string,
  schema: S,
  inputSchema: Anthropic.Messages.Tool.InputSchema,
  exec: Executor<z.infer<S>>,
) {
  return {
    name,
    description,
    schema,
    input_schema: inputSchema,
    run: (current: CvData, raw: unknown) => safe(schema, raw, (input) => exec(current, input)),
  };
}

const stringArray = { type: "array" as const, items: { type: "string" as const } };

const experienceJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    company: { type: "string" },
    role: { type: "string" },
    startDate: { type: "string", description: "YYYY or YYYY-MM" },
    endDate: { type: ["string", "null"], description: "YYYY or YYYY-MM, null if current" },
    location: { type: "string" },
    summary: { type: "string" },
    bullets: stringArray,
    stack: stringArray,
  },
  required: ["company", "role", "startDate", "endDate"],
} as const;

export const TOOLS: ReadonlyArray<{
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  input_schema: Anthropic.Messages.Tool.InputSchema;
  run: (current: CvData, raw: unknown) => ToolResultOrPromise;
}> = [
  zodTool(
    "rewrite_bullet",
    "Rewrite a single bullet in an experience. Use for tightening, quantifying, or rephrasing.",
    RewriteBulletInput,
    {
      type: "object",
      properties: {
        experienceIndex: { type: "integer", minimum: 0 },
        bulletIndex: { type: "integer", minimum: 0 },
        newBullet: { type: "string" },
      },
      required: ["experienceIndex", "bulletIndex", "newBullet"],
    },
    rewriteBullet,
  ),
  zodTool(
    "rewrite_summary",
    "Replace the CV's top-level summary paragraph.",
    RewriteSummaryInput,
    {
      type: "object",
      properties: { newSummary: { type: "string" } },
      required: ["newSummary"],
    },
    rewriteSummary,
  ),
  zodTool(
    "add_experience",
    "Add a new experience entry.",
    AddExperienceInput,
    {
      type: "object",
      properties: {
        experience: experienceJsonSchema,
        position: { type: "string", enum: ["start", "end"] },
      },
      required: ["experience"],
    },
    addExperience,
  ),
  zodTool(
    "update_experience",
    "Partially update fields of an existing experience by index.",
    UpdateExperienceInput,
    {
      type: "object",
      properties: {
        index: { type: "integer", minimum: 0 },
        patch: {
          type: "object",
          additionalProperties: false,
          properties: experienceJsonSchema.properties,
        },
      },
      required: ["index", "patch"],
    },
    updateExperience,
  ),
  zodTool(
    "remove_experience",
    "Remove an experience entry by index.",
    RemoveExperienceInput,
    {
      type: "object",
      properties: { index: { type: "integer", minimum: 0 } },
      required: ["index"],
    },
    removeExperience,
  ),
  zodTool(
    "reorder_bullets",
    "Reorder bullets of an experience. `order` is a permutation of existing bullet indices.",
    ReorderBulletsInput,
    {
      type: "object",
      properties: {
        experienceIndex: { type: "integer", minimum: 0 },
        order: { type: "array", items: { type: "integer", minimum: 0 } },
      },
      required: ["experienceIndex", "order"],
    },
    reorderBullets,
  ),
  zodTool(
    "add_skill_group",
    "Add a new skill category with its items.",
    AddSkillGroupInput,
    {
      type: "object",
      properties: {
        group: {
          type: "object",
          properties: {
            category: { type: "string" },
            items: { type: "array", items: { type: "string" }, minItems: 1 },
          },
          required: ["category", "items"],
        },
      },
      required: ["group"],
    },
    addSkillGroup,
  ),
  zodTool(
    "add_skill_item",
    "Add a skill item to an existing category (case-insensitive match) or create the category.",
    AddSkillItemInput,
    {
      type: "object",
      properties: {
        category: { type: "string" },
        item: { type: "string" },
      },
      required: ["category", "item"],
    },
    addSkillItem,
  ),
  zodTool(
    "add_project",
    "Add a new project entry.",
    AddProjectInput,
    {
      type: "object",
      properties: {
        project: {
          type: "object",
          properties: {
            name: { type: "string" },
            url: { type: "string" },
            description: { type: "string" },
            stack: stringArray,
          },
          required: ["name", "description"],
        },
      },
      required: ["project"],
    },
    addProject,
  ),
  zodTool(
    "add_education",
    "Add a new education entry.",
    AddEducationInput,
    {
      type: "object",
      properties: {
        education: {
          type: "object",
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
      required: ["education"],
    },
    addEducation,
  ),
  zodTool(
    "add_language",
    "Add a spoken language.",
    AddLanguageInput,
    {
      type: "object",
      properties: {
        language: {
          type: "object",
          properties: {
            name: { type: "string" },
            level: { type: "string" },
          },
          required: ["name", "level"],
        },
      },
      required: ["language"],
    },
    addLanguage,
  ),
  zodTool(
    "set_header",
    "Update one or more fields of the CV header (name, title, email, phone, location).",
    SetHeaderInput,
    {
      type: "object",
      properties: {
        patch: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
          },
        },
      },
      required: ["patch"],
    },
    setHeader,
  ),
  zodTool(
    "tailor_for_job",
    "Analyse a job description and report which keywords are already in the CV, which must-haves are missing, and which nice-to-haves could be added. Non-mutating: returns a summary the agent uses to drive subsequent rewrite_bullet / add_skill_item calls. Call this ONCE at the start when the user pastes a JD; do not call again unless the JD changes.",
    TailorForJobInput,
    {
      type: "object",
      properties: { jobDescription: { type: "string", minLength: 50 } },
      required: ["jobDescription"],
    },
    tailorForJob,
  ),
  zodTool(
    "check_cv_length",
    "Measure the natural A4 page count and assess one-page fit before propose_changes whenever content is added. Multi-page export is supported and preserves content; report any compression or clipping risk only for the single-page option.",
    CheckCvLengthInput,
    {
      type: "object",
      properties: {},
    },
    checkCvLength,
  ),
];

export const PROPOSE_TOOL_NAME = "propose_changes";

export const PROPOSE_TOOL = {
  name: PROPOSE_TOOL_NAME,
  description:
    "Call this exactly once when you have finished all CV mutations. Provide a short user-facing summary of what changed.",
  schema: ProposeChangesInput,
  input_schema: {
    type: "object" as const,
    properties: { summary: { type: "string" } },
    required: ["summary"],
  } satisfies Anthropic.Messages.Tool.InputSchema,
};

export function toolsForAnthropic(): Anthropic.Messages.Tool[] {
  return [
    ...TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    })),
    {
      name: PROPOSE_TOOL.name,
      description: PROPOSE_TOOL.description,
      input_schema: PROPOSE_TOOL.input_schema,
    },
  ];
}

export function findTool(name: string) {
  return TOOLS.find((t) => t.name === name) ?? null;
}

export { CvDataSchema };
