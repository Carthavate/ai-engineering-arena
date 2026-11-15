import { describe, expect, it } from "vitest";
import { captionOf, EDGES, GUESS_CAPTION, PARTS, stepAt, TOUR_MODES, TOURS } from "./ragTour";

describe("the RAG tour", () => {
  it("has unique part ids", () => {
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length);
  });

  it("only links parts that exist", () => {
    const ids = new Set(PARTS.map((p) => p.id));
    for (const e of EDGES) {
      expect(ids.has(e.from), e.id).toBe(true);
      expect(ids.has(e.to), e.id).toBe(true);
    }
  });

  it("only lights up known parts and edges, and every step lights something", () => {
    const parts = new Set(PARTS.map((p) => p.id));
    const edges = new Set(EDGES.map((e) => e.id));
    for (const mode of TOUR_MODES) {
      expect(TOURS[mode].length, mode).toBeGreaterThan(0);
      for (const step of TOURS[mode]) {
        expect(step.parts.length + step.edges.length, step.title).toBeGreaterThan(0);
        step.parts.forEach((p) => expect(parts.has(p), p).toBe(true));
        step.edges.forEach((e) => expect(edges.has(e), e).toBe(true));
      }
    }
  });

  it("indexes before anyone asks, and only the RAG tour reaches the vector database at query time", () => {
    expect(TOURS.index.every((s) => s.stage === "indexing")).toBe(true);
    expect(TOURS.norag.some((s) => s.parts.includes("vectordb"))).toBe(false);
    expect(TOURS.query.some((s) => s.parts.includes("vectordb"))).toBe(true);
  });
});

describe("stepAt", () => {
  it("clamps to the tour's first and last step", () => {
    expect(stepAt("query", -3)).toBe(TOURS.query[0]);
    expect(stepAt("query", 99)).toBe(TOURS.query[TOURS.query.length - 1]);
    expect(stepAt("index", 1)).toBe(TOURS.index[1]);
  });
});

describe("captionOf", () => {
  const part = (id: string) => PARTS.find((p) => p.id === id)!;

  it("calls an answer without retrieval a guess", () => {
    expect(captionOf(part("answer"), false)).toBe(GUESS_CAPTION);
    expect(captionOf(part("answer"), true)).toBe(part("answer").caption);
  });

  it("leaves the other parts' captions alone", () => {
    expect(captionOf(part("llm"), false)).toBe(part("llm").caption);
  });
});
