import { describe, expect, it } from "vitest";
import { matchPosting } from "@/lib/jobs/matching";
import { sampleCvData } from "@/lib/cv/sample";

describe("matchPosting", () => {
  it("returns a high score when the JD overlaps with the CV stack", () => {
    const jd = `
We are hiring a Senior Software Engineer.
Required: TypeScript, Node.js, React, PostgreSQL, AWS.
Nice to have: GraphQL, Kubernetes.
You'll lead the platform team.
`;
    const result = matchPosting(sampleCvData, jd);
    expect(result.score).toBeGreaterThan(40);
    expect(result.presentKeywords.length).toBeGreaterThan(0);
  });

  it("returns a score (0..100) and string arrays even on minimal JD", () => {
    const result = matchPosting(sampleCvData, "Required: Rust, Go, Kubernetes, Terraform.");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.presentKeywords)).toBe(true);
    expect(Array.isArray(result.missingKeywords)).toBe(true);
  });
});
