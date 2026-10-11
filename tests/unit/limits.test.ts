import { describe, expect, it } from "vitest";
import { LIMITS, levelFor } from "@/lib/cv/limits";

describe("limits.levelFor", () => {
  it("returns ok below the soft cap", () => {
    expect(levelFor(0, "bulletsPerExperience")).toBe("ok");
    expect(levelFor(LIMITS.bulletsPerExperience.soft - 1, "bulletsPerExperience")).toBe("ok");
  });
  it("returns soft at the soft cap", () => {
    expect(levelFor(LIMITS.bulletsPerExperience.soft, "bulletsPerExperience")).toBe("soft");
  });
  it("returns hard at the hard cap", () => {
    expect(levelFor(LIMITS.bulletsPerExperience.hard, "bulletsPerExperience")).toBe("hard");
    expect(levelFor(LIMITS.summaryChars.hard + 50, "summaryChars")).toBe("hard");
  });
});
