import { describe, expect, it } from "vitest";
import { canRedo, canUndo, init, push, redo, undo } from "@/lib/cv/history";

describe("history stack", () => {
  it("init has empty past/future", () => {
    const s = init({ x: 1 });
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.present).toEqual({ x: 1 });
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
  });

  it("push moves present to past, clears future", () => {
    let s = init({ x: 1 });
    s = push(s, { x: 2 });
    expect(s.past).toHaveLength(1);
    expect(s.present).toEqual({ x: 2 });
    expect(s.future).toEqual([]);
  });

  it("undo/redo round-trip", () => {
    let s = init({ x: 1 });
    s = push(s, { x: 2 });
    s = push(s, { x: 3 });
    s = undo(s);
    expect(s.present).toEqual({ x: 2 });
    s = undo(s);
    expect(s.present).toEqual({ x: 1 });
    s = redo(s);
    expect(s.present).toEqual({ x: 2 });
  });

  it("push after undo drops the future branch", () => {
    let s = init({ x: 1 });
    s = push(s, { x: 2 });
    s = undo(s);
    s = push(s, { x: 3 });
    expect(s.future).toEqual([]);
    expect(s.present).toEqual({ x: 3 });
  });

  it("caps the past at 50 entries", () => {
    let s = init({ n: 0 });
    for (let i = 1; i <= 60; i++) s = push(s, { n: i });
    expect(s.past.length).toBeLessThanOrEqual(50);
    expect(s.present).toEqual({ n: 60 });
  });

  it("undo on empty is a no-op", () => {
    const s = init({ x: 1 });
    expect(undo(s)).toBe(s);
    expect(redo(s)).toBe(s);
  });

  it("identical push is a no-op", () => {
    const a = { x: 1 };
    const s = push(init(a), a);
    expect(s.past).toEqual([]);
  });
});
