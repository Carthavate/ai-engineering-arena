import { describe, expect, it } from "vitest";
import { answer, buildPrompt, cosine, embed, EXAMPLE_QUESTIONS, KNOWLEDGE_BASE, MIN_SCORE, retrieve, tokenize } from "./ragToy";

describe("tokenize", () => {
  it("lowercases, drops filler words and folds plurals", () => {
    expect(tokenize("How many DAYS do I have to return the bikes?")).toEqual(["many", "day", "return", "bike"]);
  });

  it("keeps words ending in ss", () => {
    expect(tokenize("glass")).toEqual(["glass"]);
  });
});

describe("cosine", () => {
  it("is 1 for the same text and 0 for texts with no shared word", () => {
    const a = embed("frame warranty");
    expect(cosine(a, a)).toBeCloseTo(1);
    expect(cosine(a, embed("rain motor"))).toBe(0);
  });

  it("is 0 for an empty text", () => {
    expect(cosine(embed(""), embed("bike"))).toBe(0);
  });
});

describe("retrieve", () => {
  it("finds the chunk that answers each example question first", () => {
    for (const q of EXAMPLE_QUESTIONS.filter((e) => e.expectedSource)) {
      const [top] = retrieve(q.text);
      expect(top?.chunk.source, q.text).toBe(q.expectedSource);
    }
  });

  it("returns at most k hits, best first", () => {
    const hits = retrieve("bike return refund warranty", 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
  });

  it("returns nothing for a question that shares no word with the documents", () => {
    expect(retrieve("zebra quantum")).toEqual([]);
  });
});

describe("buildPrompt", () => {
  it("puts the numbered sources before the question", () => {
    const hits = retrieve("frame warranty", 1);
    const prompt = buildPrompt("How long is the frame warranty?", hits);
    expect(prompt).toContain(`[1] (${hits[0].chunk.source}) ${hits[0].chunk.text}`);
    expect(prompt.indexOf("[1]")).toBeLessThan(prompt.indexOf("Question: How long is the frame warranty?"));
  });

  it("says there is no context when nothing was found", () => {
    expect(buildPrompt("zebra?", [])).toContain("(no matching documents)");
  });
});

describe("answer", () => {
  const q = EXAMPLE_QUESTIONS[0];

  it("quotes the best source when retrieval is on", () => {
    const a = answer(q.text, retrieve(q.text), true);
    expect(a.kind).toBe("grounded");
    expect(a.kind === "grounded" && a.source).toBe(q.expectedSource);
    expect(a.text).toContain("30 days");
  });

  it("guesses from training data when retrieval is off", () => {
    expect(answer(q.text, [], false)).toEqual({ kind: "guess", text: q.guess });
  });

  it("has a generic guess for a question it has never seen", () => {
    expect(answer("What colour is the logo?", [], false).kind).toBe("guess");
  });

  it("says it doesn't know when the best hit is too weak", () => {
    const weak = retrieve("bike")
      .slice(0, 1)
      .map((h) => ({ ...h, score: MIN_SCORE / 2 }));
    expect(answer("bike?", weak, true).kind).toBe("unknown");
    expect(answer("zebra?", [], true).kind).toBe("unknown");
  });
});

describe("the knowledge base", () => {
  it("has unique chunk ids", () => {
    expect(new Set(KNOWLEDGE_BASE.map((c) => c.id)).size).toBe(KNOWLEDGE_BASE.length);
  });
});
