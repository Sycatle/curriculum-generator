import { describe, expect, it } from "vitest";
import { CvDataSchema, CvInputSchema, SlugSchema, ThemeSchema } from "@/lib/cv/schema";
import { blankCvData, defaultTheme } from "@/lib/cv/defaults";

describe("CvDataSchema", () => {
  it("accepts the blank CV", () => {
    expect(() => CvDataSchema.parse(blankCvData)).not.toThrow();
  });

  it("rejects empty header.name", () => {
    const bad = { ...blankCvData, header: { ...blankCvData.header, name: "" } };
    expect(() => CvDataSchema.parse(bad)).toThrow();
  });

  it("requires YYYY or YYYY-MM dates on experiences", () => {
    const bad = {
      ...blankCvData,
      experiences: [
        {
          company: "Acme",
          role: "Eng",
          startDate: "2024/01",
          endDate: null,
          bullets: [],
          stack: [],
        },
      ],
    };
    expect(() => CvDataSchema.parse(bad)).toThrow();
  });
});

describe("ThemeSchema", () => {
  it("accepts default theme", () => {
    expect(() => ThemeSchema.parse(defaultTheme)).not.toThrow();
  });

  it("defaults older themes to one-page export", () => {
    const legacyTheme = { ...defaultTheme } as Record<string, unknown>;
    delete legacyTheme.pageMode;
    expect(ThemeSchema.parse(legacyTheme).pageMode).toBe("single");
  });
});

describe("SlugSchema", () => {
  it("accepts kebab-case", () => {
    expect(SlugSchema.parse("full-stack-fr")).toBe("full-stack-fr");
  });

  it("rejects uppercase, leading dash, spaces", () => {
    expect(() => SlugSchema.parse("Full-Stack")).toThrow();
    expect(() => SlugSchema.parse("-fr")).toThrow();
    expect(() => SlugSchema.parse("full stack")).toThrow();
  });
});

describe("CvInputSchema", () => {
  it("validates a full input", () => {
    const result = CvInputSchema.parse({
      title: "CV",
      slug: "cv",
      locale: "fr",
      data: blankCvData,
      theme: defaultTheme,
      isPublic: false,
    });
    expect(result.title).toBe("CV");
  });
});
