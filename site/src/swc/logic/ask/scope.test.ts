import { describe, expect, it } from "vitest";
import { LECTURE_CHUNKS, lectureNotes, noteChunks } from "./coursePack";
import { searchableText } from "./documents";
import { scopeIndex } from "./scope";
import { bm25Index, retrieve } from "./search";

describe("scopeIndex", () => {
  const notes = noteChunks([{ id: "lesson:rag-12", itemId: "rag-12", title: "My notes", text: "unstructured hi_res tables", addedAt: "t" }]);
  const chunks = [...LECTURE_CHUNKS, ...notes];
  const vectors = chunks.map((_, i) => [i, 1]);
  const full = { chunks, bm25: bm25Index(chunks.map(searchableText)), vectors };

  it("keeps only the chosen sources, with their own vectors", () => {
    const scoped = scopeIndex(full, new Set(["rag-12", "lesson:rag-12"]));
    expect(scoped.chunks.length).toBeGreaterThan(1);
    expect(new Set(scoped.chunks.map((c) => c.sourceId))).toEqual(new Set(["rag-12", "lesson:rag-12"]));
    scoped.chunks.forEach((c, i) => expect(scoped.vectors[i]).toEqual(vectors[chunks.indexOf(c)]));
    expect(scoped.bm25.docs).toHaveLength(scoped.chunks.length);
  });

  it("never retrieves outside the scope", () => {
    const scoped = scopeIndex(full, new Set(["rag-12"]));
    // "reciprocal rank fusion" lives in lecture #15, which is out of scope.
    const trace = retrieve("reciprocal rank fusion", [1, 1], scoped.bm25, scoped.vectors);
    expect(trace.picked.every((i) => scoped.chunks[i].sourceId === "rag-12")).toBe(true);
  });

  it("is empty for unknown sources", () => {
    const scoped = scopeIndex(full, new Set(["nope"]));
    expect(scoped.chunks).toEqual([]);
    expect(scoped.vectors).toEqual([]);
  });
});

describe("lectureNotes", () => {
  it("returns a lecture's sections, and nothing for items without notes", () => {
    const s = lectureNotes("rag-12");
    expect(s.map((x) => x.heading)).toContain("Partitioning with unstructured");
    expect(s.every((x) => x.body.length > 0)).toBe(true);
    expect(lectureNotes("p1-1")).toEqual([]);
  });
});
