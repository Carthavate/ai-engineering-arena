// Retrieval for "Ask the course": BM25 keyword search + vector search, fused with reciprocal rank fusion.
// The same ideas as lessons #5 (cosine), #15 (RRF) and #16 (hybrid search), running for real.
import { cosine, type Vec } from "../lab/vectors";

const STOPWORDS = new Set(
  ("a an and are as at be but by can do does for from has have how i if in into is it its of on or so that the their "
    + "them then there these this to was what when where which who why will with you your we our").split(" "),
);

/** Lowercase words and numbers, without stopwords. */
export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:[.'-][a-z0-9]+)*/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

export interface Bm25Index {
  readonly docs: ReadonlyArray<ReadonlyMap<string, number>>;
  readonly lengths: readonly number[];
  readonly avgLength: number;
  readonly docFreq: ReadonlyMap<string, number>;
}

export function bm25Index(texts: readonly string[]): Bm25Index {
  const docs = texts.map((t) => {
    const tf = new Map<string, number>();
    for (const term of terms(t)) tf.set(term, (tf.get(term) ?? 0) + 1);
    return tf;
  });
  const lengths = docs.map((d) => [...d.values()].reduce((a, b) => a + b, 0));
  const docFreq = new Map<string, number>();
  for (const d of docs) for (const term of d.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  const avgLength = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  return { docs, lengths, avgLength, docFreq };
}

export interface Hit {
  readonly index: number;
  readonly score: number;
}

/**
 * BM25 (k1 = 1.5, b = 0.75): rewards query terms that appear often in a chunk (with diminishing returns),
 * are rare across chunks (IDF), and normalises for chunk length.
 */
export function bm25Search(index: Bm25Index, query: string, n: number, k1 = 1.5, b = 0.75): Hit[] {
  const q = [...new Set(terms(query))];
  const total = index.docs.length;
  const hits = index.docs.map((tf, i) => {
    let score = 0;
    for (const term of q) {
      const f = tf.get(term);
      if (!f) continue;
      const df = index.docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * index.lengths[i]) / (index.avgLength || 1))));
    }
    return { index: i, score };
  });
  return hits.filter((h) => h.score > 0).sort((x, y) => y.score - x.score || x.index - y.index).slice(0, n);
}

/** Cosine similarity of the query to every chunk, best first. */
export function vectorSearch(query: Vec, vectors: readonly Vec[], n: number): Hit[] {
  return vectors
    .map((v, index) => ({ index, score: cosine(query, v) }))
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .slice(0, n);
}

export interface FusedHit {
  readonly index: number;
  /** Sum of 1 / (k + rank) over the lists the chunk appears in. */
  readonly score: number;
  /** 1-based rank in each input list, or null when absent. */
  readonly ranks: readonly (number | null)[];
}

/** Reciprocal rank fusion (lesson #15): score = sum of 1 / (k + rank), ranks starting at 1. */
export function rrf(lists: ReadonlyArray<readonly Hit[]>, k = 60): FusedHit[] {
  const fused = new Map<number, { score: number; ranks: (number | null)[] }>();
  lists.forEach((list, li) => {
    list.forEach((hit, r) => {
      const entry = fused.get(hit.index) ?? { score: 0, ranks: lists.map(() => null) };
      entry.score += 1 / (k + r + 1);
      entry.ranks[li] = r + 1;
      fused.set(hit.index, entry);
    });
  });
  return [...fused.entries()]
    .map(([index, e]) => ({ index, score: e.score, ranks: e.ranks }))
    .sort((x, y) => y.score - x.score || x.index - y.index);
}

/** Everything that happened during retrieval, so the UI can show the pipeline. */
export interface RetrievalTrace {
  readonly query: string;
  readonly keyword: readonly Hit[];
  readonly vector: readonly Hit[];
  readonly fused: readonly FusedHit[];
  /** Indexes of the chunks sent to the model, best first. */
  readonly picked: readonly number[];
}

export function retrieve(
  query: string,
  queryVector: Vec,
  index: Bm25Index,
  vectors: readonly Vec[],
  options: { readonly perList?: number; readonly top?: number } = {},
): RetrievalTrace {
  const perList = options.perList ?? 8;
  const keyword = bm25Search(index, query, perList);
  const vector = vectorSearch(queryVector, vectors, perList);
  const fused = rrf([vector, keyword]);
  return { query, keyword, vector, fused, picked: fused.slice(0, options.top ?? 4).map((f) => f.index) };
}
