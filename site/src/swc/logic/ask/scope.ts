// Searching only part of the course, e.g. one lecture and the player's notes on it (the lesson panel).
import type { Vec } from "../lab/vectors";
import { searchableText, type Chunk } from "./documents";
import { bm25Index, type Bm25Index } from "./search";

/** Chunks with their keyword index and embeddings (vectors[i] belongs to chunks[i]). */
export interface SearchIndex {
  readonly chunks: readonly Chunk[];
  readonly bm25: Bm25Index;
  readonly vectors: readonly Vec[];
}

/**
 * The part of an index whose chunks come from the given sources. The keyword index is rebuilt over
 * those chunks only, so BM25's term rarity (IDF) reflects what is actually being searched.
 */
export function scopeIndex(index: SearchIndex, sourceIds: ReadonlySet<string>): SearchIndex {
  const keep = index.chunks.flatMap((c, i) => (sourceIds.has(c.sourceId) ? [i] : []));
  const chunks = keep.map((i) => index.chunks[i]);
  return { chunks, vectors: keep.map((i) => index.vectors[i]), bm25: bm25Index(chunks.map(searchableText)) };
}
