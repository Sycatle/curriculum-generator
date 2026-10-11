import { describe, expect, it } from "vitest";
import { formatAtsDate, formatLinkText, toMonthYear } from "@/lib/cv/format";

describe("toMonthYear", () => {
  it("converts YYYY-MM to MM/YYYY", () => {
    expect(toMonthYear("2023-03")).toBe("03/2023");
    expect(toMonthYear("2023-3")).toBe("03/2023");
  });
  it("falls back to 01 for year-only", () => {
    expect(toMonthYear("2023")).toBe("01/2023");
  });
  it("returns null for empty/undefined", () => {
    expect(toMonthYear(null)).toBeNull();
    expect(toMonthYear("")).toBeNull();
    expect(toMonthYear(undefined)).toBeNull();
  });
});

describe("formatAtsDate", () => {
  it("renders period with Present", () => {
    expect(formatAtsDate("2023-03", null)).toBe("03/2023 – Present");
    expect(formatAtsDate("2023-03", null, "fr")).toBe("03/2023 – Présent");
  });
  it("renders closed period", () => {
    expect(formatAtsDate("2021-01", "2023-06")).toBe("01/2021 – 06/2023");
  });
  it("returns empty when no start", () => {
    expect(formatAtsDate(null, null)).toBe("");
  });
});

describe("formatLinkText", () => {
  it("strips protocol and www", () => {
    expect(formatLinkText("https://github.com/sycatle")).toBe("github.com/sycatle");
    expect(formatLinkText("http://www.example.com/")).toBe("example.com");
  });
});
