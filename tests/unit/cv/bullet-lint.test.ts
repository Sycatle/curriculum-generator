import { describe, expect, it } from "vitest";
import { lintBullet } from "@/lib/cv/bullet-lint";

describe("lintBullet", () => {
  it("gives a perfect score to a strong bullet", () => {
    const r = lintBullet(
      "Rebuilt auth service in Go, cutting login p95 from 850 ms to 120 ms across 500K MAU.",
    );
    expect(r.warnings).toEqual([]);
    expect(r.quality).toBe(100);
  });

  it("flags weak verb", () => {
    const r = lintBullet("Helped the team migrate to Kubernetes, reducing cost by 30%.");
    expect(r.warnings).toContain("weak-verb");
  });

  it("flags missing metric", () => {
    const r = lintBullet("Built a new payments pipeline in Go.");
    expect(r.warnings).toContain("no-metric");
  });

  it("flags passive voice", () => {
    const r = lintBullet("The auth service was rebuilt to reduce latency by 50%.");
    expect(r.warnings).toContain("passive");
  });

  it("flags too short", () => {
    const r = lintBullet("Built auth.");
    expect(r.warnings).toContain("too-short");
  });
});
