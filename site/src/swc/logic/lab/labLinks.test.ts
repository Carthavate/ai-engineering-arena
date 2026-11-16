import { describe, expect, it } from "vitest";
import { PHASES } from "../roadmap";
import { CHALLENGES } from "./challenges";
import { EXPLORERS, LAB_TOOLS, labLinksFor } from "./labLinks";

const itemIds = new Set(PHASES.flatMap((p) => p.items.map((i) => i.id)));

describe("labLinksFor", () => {
  it("sends the first RAG lesson to the How RAG works explorer", () => {
    expect(labLinksFor("rag-1")).toEqual([
      expect.objectContaining({ kind: "explore", lab: "how-rag-works", title: "How RAG works" }),
    ]);
  });

  it("lists explorers first, then the lesson's challenges", () => {
    const links = labLinksFor("rag-3");
    expect(links.map((l) => l.kind)).toEqual(["explore", "explore", "challenge"]);
    expect(links[0]).toMatchObject({ lab: "chunking", title: "Chunking" });
    expect(links[2]).toMatchObject({ lab: "chunk-overlap", title: "Chunk text with overlap", level: "easy" });
  });

  it("links every challenge from the lesson it practises", () => {
    for (const c of CHALLENGES) {
      expect(labLinksFor(c.item).some((l) => l.lab === c.id), c.id).toBe(true);
    }
  });

  it("gives nothing for a lesson without a Lab page", () => {
    expect(labLinksFor("rag-7")).toEqual([]);
    expect(labLinksFor("no-such-lesson")).toEqual([]);
  });
});

describe("the explorer map", () => {
  it("only names real lessons and real Lab tools", () => {
    for (const [itemId, entries] of Object.entries(EXPLORERS)) {
      expect(itemIds.has(itemId), itemId).toBe(true);
      for (const e of entries) expect(e.tool in LAB_TOOLS, `${itemId} → ${e.tool}`).toBe(true);
    }
  });

  it("never uses a challenge id as a tool id", () => {
    const challengeIds = new Set(CHALLENGES.map((c) => c.id));
    for (const tool of Object.keys(LAB_TOOLS)) expect(challengeIds.has(tool), tool).toBe(false);
  });
});
