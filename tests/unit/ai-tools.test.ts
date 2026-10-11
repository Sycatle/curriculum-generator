import { describe, expect, it } from "vitest";
import { findTool } from "@/lib/ai/tools";
import type { CvData } from "@/lib/cv/schema";

const baseCv: CvData = {
  header: { name: "Alice", title: "Dev", phone: undefined, location: undefined, links: [] },
  summary: "Old summary",
  experiences: [
    {
      company: "Acme",
      role: "Engineer",
      startDate: "2020-01",
      endDate: null,
      location: undefined,
      summary: undefined,
      bullets: ["Did stuff", "Did more stuff"],
      stack: [],
    },
  ],
  projects: [],
  education: [],
  skills: [{ category: "Languages", items: ["TypeScript"] }],
  languages: [],
  certifications: [],
  interests: [],
};

describe("ai tools", () => {
  it("rewrite_bullet replaces the targeted bullet", async () => {
    const tool = findTool("rewrite_bullet")!;
    const res = await tool.run(baseCv, {
      experienceIndex: 0,
      bulletIndex: 1,
      newBullet: "Shipped feature X with 30% faster latency",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next.experiences[0]!.bullets[1]).toMatch(/Shipped feature X/);
    expect(res.next.experiences[0]!.bullets[0]).toBe("Did stuff");
  });

  it("tailor_for_job reports coverage and gaps", async () => {
    const tool = findTool("tailor_for_job")!;
    const res = await tool.run(baseCv, {
      jobDescription:
        "Requirements: Strong experience with Go and Kubernetes. Nice to have: Terraform, PostgreSQL.",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.summary).toMatch(/Coverage must-have/);
    expect(res.summary).toMatch(/Missing/);
  });

  it("tailor_for_job rejects short input", async () => {
    const tool = findTool("tailor_for_job")!;
    const res = await tool.run(baseCv, { jobDescription: "too short" });
    expect(res.ok).toBe(false);
  });

  it("rewrite_bullet rejects out-of-range index", async () => {
    const tool = findTool("rewrite_bullet")!;
    const res = await tool.run(baseCv, {
      experienceIndex: 0,
      bulletIndex: 9,
      newBullet: "x",
    });
    expect(res.ok).toBe(false);
  });

  it("add_skill_item adds to existing category case-insensitively", async () => {
    const tool = findTool("add_skill_item")!;
    const res = await tool.run(baseCv, { category: "languages", item: "Go" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next.skills[0]!.items).toEqual(["TypeScript", "Go"]);
  });

  it("add_skill_item rejects duplicates", async () => {
    const tool = findTool("add_skill_item")!;
    const res = await tool.run(baseCv, { category: "Languages", item: "typescript" });
    expect(res.ok).toBe(false);
  });

  it("add_skill_item creates category when missing", async () => {
    const tool = findTool("add_skill_item")!;
    const res = await tool.run(baseCv, { category: "Tools", item: "Docker" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next.skills).toHaveLength(2);
    expect(res.next.skills[1]).toEqual({ category: "Tools", items: ["Docker"] });
  });

  it("set_header merges header patch", async () => {
    const tool = findTool("set_header")!;
    const res = await tool.run(baseCv, { patch: { title: "Senior Dev" } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next.header.title).toBe("Senior Dev");
    expect(res.next.header.name).toBe("Alice");
  });

  it("update_experience applies a partial patch", async () => {
    const tool = findTool("update_experience")!;
    const res = await tool.run(baseCv, { index: 0, patch: { role: "Staff Engineer" } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next.experiences[0]!.role).toBe("Staff Engineer");
    expect(res.next.experiences[0]!.company).toBe("Acme");
  });

  it("remove_experience deletes by index", async () => {
    const tool = findTool("remove_experience")!;
    const res = await tool.run(baseCv, { index: 0 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next.experiences).toHaveLength(0);
  });

  it("reorder_bullets validates permutation", async () => {
    const tool = findTool("reorder_bullets")!;
    const ok = await tool.run(baseCv, { experienceIndex: 0, order: [1, 0] });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.next.experiences[0]!.bullets).toEqual(["Did more stuff", "Did stuff"]);

    const bad = await tool.run(baseCv, { experienceIndex: 0, order: [0, 0] });
    expect(bad.ok).toBe(false);
  });

  it("does not mutate the input CV", async () => {
    const tool = findTool("rewrite_bullet")!;
    await tool.run(baseCv, { experienceIndex: 0, bulletIndex: 0, newBullet: "new" });
    expect(baseCv.experiences[0]!.bullets[0]).toBe("Did stuff");
  });

  it("check_cv_length reports a fitting CV as green", async () => {
    const tool = findTool("check_cv_length")!;
    const res = await tool.run(baseCv, {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next).toBe(baseCv);
    expect(res.summary).toMatch(/Fits on 1 A4 page/i);
  }, 15000);
});
