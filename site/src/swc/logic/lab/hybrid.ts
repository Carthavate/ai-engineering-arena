// The Lab's hybrid search explorer: BM25 keyword scoring with its full breakdown, vector ranking, and
// reciprocal rank fusion (RRF) of the two lists, weighted as in LangChain's EnsembleRetriever.
import { tokenize } from "./ragToy";
import { cosine, type Vec } from "./vectors";

export interface HybridDoc {
  readonly id: string;
  readonly title: string;
  readonly text: string;
}

export interface HybridQuery {
  readonly text: string;
  /** What this query shows about keyword vs vector search. */
  readonly notice: string;
}

/** The bike shop's help snippets again, plus a part number and a kids' bike, so exact codes and paraphrases both come up. */
export const HYBRID_DOCS: readonly HybridDoc[] = [
  { id: "returns", title: "Returns", text: "You can return any Orbit bike within 30 days of delivery for a full refund." },
  { id: "refund-timing", title: "Refund timing", text: "Refunds reach the original card within 5 working days of the return arriving." },
  { id: "frame-warranty", title: "Frame warranty", text: "Every Orbit frame has a 5-year warranty against cracks and weld failures." },
  { id: "wear-parts", title: "Wear parts", text: "Brakes, tyres and chains wear out with use and are not covered by the warranty." },
  { id: "e2-water", title: "E2 in the rain", text: "The Orbit E2 is rated IPX5: riding in rain is fine, but never pressure-wash the motor." },
  { id: "e2-battery", title: "E2 battery", text: "A full charge of the E2 battery takes 4 hours and gives about 80 km of range." },
  { id: "e2-winter", title: "E2 in winter", text: "Store the E2 battery indoors when the temperature drops below freezing." },
  { id: "brake-pads", title: "Brake pads", text: "Replacement brake pads for the E2 have the part number BP-4471." },
  { id: "delivery", title: "Delivery", text: "Orders above 500 TND ship free; smaller orders pay 15 TND." },
  { id: "assembly", title: "Assembly", text: "Bikes arrive almost fully assembled: you only fit the pedals and the handlebar." },
  { id: "store-hours", title: "Store hours", text: "The Tunis store is open Monday to Saturday from 9:00 to 19:00." },
  { id: "kids-bike", title: "Kids' bike", text: "The Orbit Mini fits riders from 6 to 9 years old." },
];

export const HYBRID_QUERIES: readonly HybridQuery[] = [
  { text: "BP-4471", notice: "An exact code. BM25 returns exactly one document, the only one containing it. Vector search ranks it first too, but with a weak similarity, and fills the rest of its list with unrelated snippets: a retriever always returns its k results, relevant or not." },
  { text: "Can I get my money back?", notice: "No query word appears in any document, so BM25 finds nothing. Vector search knows \"money back\" means a refund." },
  { text: "E2 battery in the cold", notice: "Both lists agree on the top two, so fusion keeps them there. BM25 gets there on \"E2\" and \"battery\"; vector search also understands that cold means freezing, a word the query never uses." },
  { text: "Is it ok to ride the e-bike when it's wet?", notice: "BM25 latches onto \"bike\" in two wrong documents. Vector search ranks the rain rating first, yet fusion puts it third: RRF rewards documents found by both lists, and the wrong ones are in both. Set the weight to vector only, or see lesson #17: a reranker fixes exactly this." },
];

/** How many results each retriever hands to fusion, as a retriever's k would. */
export const TOP_N = 5;
/** The usual BM25 settings (Lucene, Elasticsearch, rank_bm25): k1 sets how fast repeats saturate, b how much length counts. */
export const BM25_DEFAULTS = { k1: 1.5, b: 0.75 } as const;
/** The k in 1 / (k + rank), from the original RRF paper (Cormack et al., 2009) and LangChain's default. */
export const RRF_DEFAULT_K = 60;

interface IndexedDoc {
  readonly id: string;
  readonly length: number;
  readonly tf: ReadonlyMap<string, number>;
}

export interface Bm25Index {
  readonly n: number;
  readonly avgLength: number;
  /** How many documents contain each word. */
  readonly df: ReadonlyMap<string, number>;
  readonly docs: readonly IndexedDoc[];
}

export interface Bm25Params {
  readonly k1: number;
  readonly b: number;
}

export interface Ranked {
  readonly id: string;
  readonly rank: number;
  readonly score: number;
}

export interface TermScore {
  readonly term: string;
  /** How often the word appears in this document. */
  readonly tf: number;
  readonly df: number;
  readonly idf: number;
  readonly contribution: number;
}

export interface Bm25Ranked extends Ranked {
  readonly terms: readonly TermScore[];
}

export function bm25Index(docs: readonly HybridDoc[]): Bm25Index {
  const indexed = docs.map((d) => {
    const tokens = tokenize(d.text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { id: d.id, length: tokens.length, tf };
  });
  const df = new Map<string, number>();
  for (const d of indexed) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLength = indexed.reduce((s, d) => s + d.length, 0) / Math.max(1, indexed.length);
  return { n: indexed.length, avgLength, df, docs: indexed };
}

/** Lucene's BM25 idf: rare words count a lot, words in every document almost nothing (never below zero). */
export function idf(n: number, df: number): number {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

/** How much a word appearing tf times counts, before idf: it grows with tf but levels off at k1 + 1, and long documents count less. */
export function saturation(tf: number, k1: number, b: number, docLength: number, avgLength: number): number {
  if (tf === 0) return 0;
  return (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * docLength) / avgLength));
}

/** BM25: for every query word in the document, idf × saturation. Documents scoring 0 are left out. */
export function bm25Rank(query: string, index: Bm25Index, params: Bm25Params = BM25_DEFAULTS, topN: number = TOP_N): Bm25Ranked[] {
  const words = [...new Set(tokenize(query))];
  return index.docs
    .map((d) => {
      const terms = words.flatMap((term) => {
        const tf = d.tf.get(term) ?? 0;
        if (tf === 0) return [];
        const df = index.df.get(term) ?? 0;
        const w = idf(index.n, df);
        return [{ term, tf, df, idf: w, contribution: w * saturation(tf, params.k1, params.b, d.length, index.avgLength) }];
      });
      return { id: d.id, terms, score: terms.reduce((s, t) => s + t.contribution, 0) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Dense retrieval: documents ranked by cosine similarity between their vector and the query's. */
export function vectorRank(queryVec: Vec, docVecs: readonly Vec[], ids: readonly string[], topN: number = TOP_N): Ranked[] {
  if (docVecs.length !== ids.length) throw new Error(`Expected one vector per document: ${ids.length} ids, ${docVecs.length} vectors`);
  return docVecs
    .map((v, i) => ({ id: ids[i], score: cosine(queryVec, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export interface RankedList {
  readonly name: string;
  readonly ranked: readonly Ranked[];
  readonly weight: number;
}

export interface FusedPart {
  readonly list: string;
  /** The document's rank in that list, or null if the list didn't return it. */
  readonly rank: number | null;
  readonly contribution: number;
}

export interface Fused extends Ranked {
  readonly parts: readonly FusedPart[];
}

/**
 * Weighted reciprocal rank fusion: a document scores weight / (k + rank) from every list that returned it.
 * Only ranks matter, so BM25 scores and cosine similarities never need to be put on the same scale.
 * Documents that score 0 (found only by lists weighted 0) are left out.
 */
export function fuse(lists: readonly RankedList[], k: number = RRF_DEFAULT_K): Fused[] {
  const ids = [...new Set(lists.flatMap((l) => l.ranked.map((r) => r.id)))];
  return ids
    .map((id) => {
      const parts = lists.map((l) => {
        const rank = l.ranked.find((r) => r.id === id)?.rank ?? null;
        return { list: l.name, rank, contribution: rank === null ? 0 : l.weight / (k + rank) };
      });
      return { id, parts, score: parts.reduce((s, p) => s + p.contribution, 0) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
