import { describe, expect, it } from "vitest";
import {
  BM25_DEFAULTS, bm25Index, bm25Rank, fuse, HYBRID_DOCS, HYBRID_QUERIES, RRF_DEFAULT_K, saturation, TOP_N, vectorRank, type Ranked,
} from "./hybrid";

const index = bm25Index(HYBRID_DOCS);
const ids = (r: readonly Ranked[]) => r.map((x) => x.id);

describe("bm25Index", () => {
  it("counts documents, their lengths and how many documents hold each word", () => {
    expect(index.n).toBe(HYBRID_DOCS.length);
    expect(index.avgLength).toBeGreaterThan(0);
    expect(index.df.get("e2")).toBe(HYBRID_DOCS.filter((d) => /\bE2\b/.test(d.text)).length);
  });
});

describe("bm25Rank", () => {
  it("finds an exact part number", () => {
    const [top] = bm25Rank("BP-4471", index);
    expect(top.id).toBe("brake-pads");
    expect(top.terms.map((t) => t.term)).toEqual(["bp", "4471"]);
  });

  it("finds nothing when no query word is in any document", () => {
    expect(bm25Rank("Can I get my money back?", index)).toEqual([]);
  });

  it("explains each score as the sum of its terms", () => {
    for (const r of bm25Rank("E2 battery in the cold", index)) {
      expect(r.terms.reduce((s, t) => s + t.contribution, 0)).toBeCloseTo(r.score);
    }
  });

  it("gives rarer words more weight", () => {
    const [top] = bm25Rank("E2 battery", index);
    const byTerm = Object.fromEntries(top.terms.map((t) => [t.term, t.idf]));
    expect(byTerm.battery).toBeGreaterThan(byTerm.e2);
  });

  it("ranks at most TOP_N documents, best first", () => {
    const r = bm25Rank("E2 bike battery brake", index);
    expect(r.length).toBeLessThanOrEqual(TOP_N);
    expect(r.map((x) => x.rank)).toEqual(r.map((_, i) => i + 1));
  });
});

describe("saturation", () => {
  const avg = 10;

  it("grows with term frequency but levels off", () => {
    const one = saturation(1, BM25_DEFAULTS.k1, BM25_DEFAULTS.b, avg, avg);
    const ten = saturation(10, BM25_DEFAULTS.k1, BM25_DEFAULTS.b, avg, avg);
    expect(ten).toBeGreaterThan(one);
    expect(ten).toBeLessThan(BM25_DEFAULTS.k1 + 1);
  });

  it("is 0 for a word that isn't there, and counts only presence when k1 is 0", () => {
    expect(saturation(0, 1.5, 0.75, avg, avg)).toBe(0);
    expect(saturation(7, 0, 0.75, avg, avg)).toBe(1);
  });

  it("penalises long documents more as b grows", () => {
    expect(saturation(2, 1.5, 1, 30, avg)).toBeLessThan(saturation(2, 1.5, 0, 30, avg));
  });
});

describe("vectorRank", () => {
  it("refuses ids and vectors that don't line up", () => {
    expect(() => vectorRank([1, 0], [[1, 0]], ["a", "b"])).toThrow();
  });

  it("ranks documents by cosine similarity to the query", () => {
    const docs = [[1, 0], [0, 1], [0.7, 0.7]];
    expect(ids(vectorRank([1, 0.1], docs, ["a", "b", "c"]))).toEqual(["a", "c", "b"]);
  });
});

describe("fuse", () => {
  const bm25: Ranked[] = [{ id: "a", rank: 1, score: 9 }, { id: "b", rank: 2, score: 5 }];
  const vector: Ranked[] = [{ id: "b", rank: 1, score: 0.9 }, { id: "c", rank: 2, score: 0.8 }];

  it("adds weight / (k + rank) from every list a document appears in", () => {
    const fused = fuse([{ name: "bm25", ranked: bm25, weight: 1 }, { name: "vector", ranked: vector, weight: 1 }], 60);
    expect(fused[0].id).toBe("b");
    expect(fused[0].score).toBeCloseTo(1 / 62 + 1 / 61);
    expect(fused[0].parts).toEqual([{ list: "bm25", rank: 2, contribution: 1 / 62 }, { list: "vector", rank: 1, contribution: 1 / 61 }]);
    expect(fused.find((f) => f.id === "c")!.parts[0]).toEqual({ list: "bm25", rank: null, contribution: 0 });
  });

  it("lets a weight of zero switch a list off, dropping what only that list found", () => {
    const fused = fuse([{ name: "bm25", ranked: bm25, weight: 1 }, { name: "vector", ranked: vector, weight: 0 }], 60);
    expect(fused.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("makes rank differences matter more when k is small", () => {
    const gap = (k: number) => {
      const f = fuse([{ name: "bm25", ranked: bm25, weight: 1 }], k);
      return f[0].score - f[1].score;
    };
    expect(gap(1)).toBeGreaterThan(gap(RRF_DEFAULT_K));
  });
});

describe("the presets", () => {
  it("each say what to notice", () => {
    for (const q of HYBRID_QUERIES) expect(q.notice.length).toBeGreaterThan(20);
  });

  it("have unique document ids", () => {
    expect(new Set(HYBRID_DOCS.map((d) => d.id)).size).toBe(HYBRID_DOCS.length);
  });
});
