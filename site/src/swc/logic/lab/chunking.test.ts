import { describe, expect, it } from "vitest";
import {
  answerCheck, boundaryIsClean, CHUNK_QUESTIONS, chunkStats, fixedChunks, percentile, recursiveChunks, recursiveSplit,
  SAMPLE_DOC, segmentsOf, semanticChunks, sentencesOf, type Chunk,
} from "./chunking";

const text = (c: Chunk) => SAMPLE_DOC.slice(c.start, c.end);

describe("sentencesOf", () => {
  it("finds each sentence with its offsets", () => {
    const s = sentencesOf("One here. Two there!\n\nThree?");
    expect(s.map((x) => "One here. Two there!\n\nThree?".slice(x.start, x.end))).toEqual(["One here.", "Two there!", "Three?"]);
  });

  it("keeps a decimal number inside its sentence", () => {
    expect(sentencesOf("It is 3.5 km away. Then stop.")).toHaveLength(2);
  });

  it("splits the sample into its sentences", () => {
    expect(sentencesOf(SAMPLE_DOC).length).toBeGreaterThan(12);
  });
});

describe("fixedChunks", () => {
  it("cuts every `size` characters, stepping back by `overlap`", () => {
    const c = fixedChunks("abcdefghij", 4, 1);
    expect(c.map((x) => "abcdefghij".slice(x.start, x.end))).toEqual(["abcd", "defg", "ghij"]);
  });

  it("refuses a size below 1", () => {
    expect(() => fixedChunks("abc", 0, 0)).toThrow();
  });

  it("covers the whole text and never loops when overlap is too big", () => {
    const c = fixedChunks(SAMPLE_DOC, 100, 500);
    expect(c[0].start).toBe(0);
    expect(c[c.length - 1].end).toBe(SAMPLE_DOC.length);
  });
});

describe("recursiveChunks", () => {
  it("keeps chunks within the size and prefers paragraph, then sentence breaks", () => {
    const chunks = recursiveChunks(SAMPLE_DOC, 300, 0);
    for (const c of chunks) expect(c.end - c.start).toBeLessThanOrEqual(300);
    expect(chunks.every((c) => boundaryIsClean(SAMPLE_DOC, c.end))).toBe(true);
  });

  it("reports only the separators that actually cut", () => {
    expect(recursiveSplit(SAMPLE_DOC, 300, 0).used).toEqual(["\n\n"]);
    expect(recursiveSplit(SAMPLE_DOC, 150, 0).used).toEqual(["\n\n", ". "]);
    expect(recursiveSplit("short", 300, 0).used).toEqual([]);
  });

  it("cuts mid-word only when nothing else fits", () => {
    const chunks = recursiveChunks("aaaaaaaaaa", 4, 0);
    expect(chunks.map((c) => c.end - c.start)).toEqual([4, 4, 2]);
  });

  it("repeats trailing pieces at the start of the next chunk as overlap", () => {
    const chunks = recursiveChunks(SAMPLE_DOC, 200, 80);
    expect(chunks.some((c, i) => i > 0 && c.start < chunks[i - 1].end)).toBe(true);
  });
});

describe("semanticChunks", () => {
  const sentences = ["Cats purr.", "Kittens nap.", "Stocks fell.", "Bonds rose."];
  const doc = sentences.join(" ");
  // Two topics: vectors point the same way within a topic and at right angles across topics.
  const vectors = [[1, 0], [0.95, 0.05], [0, 1], [0.05, 0.95]];

  it("breaks where neighbouring sentences drift apart", () => {
    const r = semanticChunks(doc, vectors, 50);
    expect(r.chunks.map((c) => doc.slice(c.start, c.end))).toEqual(["Cats purr. Kittens nap.", "Stocks fell. Bonds rose."]);
    expect(r.distances).toHaveLength(3);
    expect(r.breaks).toEqual([1]);
  });

  it("keeps everything together when the threshold is at the top", () => {
    expect(semanticChunks(doc, vectors, 100).chunks).toHaveLength(1);
  });

  it("gives no chunks for text without sentences", () => {
    expect(semanticChunks("   ", [], 50)).toEqual({ chunks: [], distances: [], threshold: 0, breaks: [] });
  });

  it("needs one vector per sentence", () => {
    expect(() => semanticChunks(doc, vectors.slice(1), 50)).toThrow();
  });
});

describe("percentile", () => {
  it("interpolates between sorted values", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([0, 10], 25)).toBe(2.5);
    expect(percentile([], 50)).toBe(0);
  });
});

describe("segmentsOf", () => {
  it("marks which chunks cover each stretch of text, overlaps included", () => {
    const segs = segmentsOf(10, [{ start: 0, end: 6 }, { start: 4, end: 10 }]);
    expect(segs).toEqual([
      { start: 0, end: 4, chunks: [0] },
      { start: 4, end: 6, chunks: [0, 1] },
      { start: 6, end: 10, chunks: [1] },
    ]);
  });

  it("also cuts at extra marks inside the text", () => {
    expect(segmentsOf(10, [{ start: 0, end: 10 }], [3, 7, 99]).map((s) => [s.start, s.end])).toEqual([[0, 3], [3, 7], [7, 10]]);
  });

  it("leaves uncovered whitespace between chunks as its own segment", () => {
    expect(segmentsOf(5, [{ start: 0, end: 2 }, { start: 3, end: 5 }])[1]).toEqual({ start: 2, end: 3, chunks: [] });
  });
});

describe("chunkStats", () => {
  it("counts chunks and the cuts that land mid-sentence", () => {
    const fixed = chunkStats(SAMPLE_DOC, fixedChunks(SAMPLE_DOC, 120, 0));
    const recursive = chunkStats(SAMPLE_DOC, recursiveChunks(SAMPLE_DOC, 300, 0));
    expect(fixed.count).toBeGreaterThan(5);
    expect(fixed.brokenCuts).toBeGreaterThan(0);
    expect(recursive.brokenCuts).toBe(0);
  });
});

describe("answerCheck", () => {
  const q = CHUNK_QUESTIONS[0];

  it("finds the whole answer in one chunk when chunks follow sentences", () => {
    const r = answerCheck(SAMPLE_DOC, recursiveChunks(SAMPLE_DOC, 300, 0), q);
    expect(r.verdict).toBe("whole");
    expect(text(r.chunks[r.top!])).toContain(q.answer);
  });

  it("reports a split answer when a cut runs through it", () => {
    const answerStart = SAMPLE_DOC.indexOf(q.answer);
    const cut = answerStart + 20;
    const r = answerCheck(SAMPLE_DOC, [{ start: 0, end: cut }, { start: cut, end: SAMPLE_DOC.length }], q);
    expect(r.verdict).toBe("split");
    expect(r.spans).toEqual([0, 1]);
  });

  it("retrieves nothing when the question shares no word with any chunk", () => {
    const r = answerCheck("Zebras graze. Lions sleep.", [{ start: 0, end: 13 }, { start: 14, end: 26 }], { text: "How many days?", answer: "Zebras graze." });
    expect(r.top).toBeNull();
    expect(r.verdict).toBe("nothing");
  });

  it("can't judge when the answer isn't in the text", () => {
    expect(answerCheck("Something else entirely.", [{ start: 0, end: 24 }], q).verdict).toBe("absent");
  });

  it("has every preset answer in the sample", () => {
    for (const p of CHUNK_QUESTIONS) expect(SAMPLE_DOC).toContain(p.answer);
  });
});

describe("boundaryIsClean", () => {
  it("treats Windows line breaks and leading spaces as clean edges", () => {
    expect(boundaryIsClean("Heading\r\nBody", 7)).toBe(true);
    expect(boundaryIsClean("   text", 2)).toBe(true);
  });

  it("flags a cut through a word", () => {
    expect(boundaryIsClean("A full charge", 4)).toBe(false);
  });
});
