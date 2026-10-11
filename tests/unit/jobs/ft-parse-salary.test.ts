import { describe, expect, it } from "vitest";
import { parseSalary, parseExperienceMonths } from "@/lib/jobs/sources/france-travail";

describe("parseSalary", () => {
  it("parses annual range with Euros suffix", () => {
    expect(parseSalary("Annuel de 35000 Euros à 45000 Euros sur 12 mois")).toMatchObject({
      min: 35000,
      max: 45000,
      period: "year",
    });
  });

  it("parses K€ suffix multiplied by 1000", () => {
    expect(parseSalary("Annuel de 45K€ à 60K€")).toMatchObject({
      min: 45000,
      max: 60000,
      period: "year",
    });
  });

  it("parses monthly with euro symbol", () => {
    expect(parseSalary("Mensuel de 2500€ à 3000€")).toMatchObject({
      min: 2500,
      max: 3000,
      period: "month",
    });
  });

  it("parses single hourly value with decimal comma", () => {
    expect(parseSalary("Horaire 12,50€")).toMatchObject({
      min: 13, // rounded
      max: null,
      period: "hour",
    });
  });

  it("parses annual single value", () => {
    expect(parseSalary("Annuel 35000 Euros")).toMatchObject({
      min: 35000,
      max: null,
      period: "year",
    });
  });

  it("returns null on empty input", () => {
    expect(parseSalary("")).toBeNull();
    expect(parseSalary(undefined)).toBeNull();
    expect(parseSalary(null)).toBeNull();
  });

  it("handles missing period by keeping numbers", () => {
    const r = parseSalary("À partir de 40000 EUR");
    expect(r?.min).toBe(40000);
    expect(r?.period).toBeNull();
  });

  it("returns null amounts when only period words are present", () => {
    expect(parseSalary("Annuel")).toMatchObject({
      min: null,
      max: null,
      period: "year",
    });
  });

  it("normalizes spaces inside numbers", () => {
    expect(parseSalary("Annuel de 35 000 Euros à 45 000 Euros")).toMatchObject({
      min: 35000,
      max: 45000,
    });
  });
});

describe("parseExperienceMonths", () => {
  it("parses 'X An(s)' to months", () => {
    expect(parseExperienceMonths("3 An(s)")).toBe(36);
    expect(parseExperienceMonths("1 An")).toBe(12);
    expect(parseExperienceMonths("5 Ans")).toBe(60);
  });

  it("parses months directly", () => {
    expect(parseExperienceMonths("6 mois")).toBe(6);
    expect(parseExperienceMonths("18 mois")).toBe(18);
  });

  it("returns 0 for 'Débutant accepté'", () => {
    expect(parseExperienceMonths("Débutant accepté")).toBe(0);
    expect(parseExperienceMonths("Debutant")).toBe(0);
  });

  it("returns null on unparseable input", () => {
    expect(parseExperienceMonths(undefined)).toBeNull();
    expect(parseExperienceMonths("")).toBeNull();
    expect(parseExperienceMonths("À négocier")).toBeNull();
  });
});
