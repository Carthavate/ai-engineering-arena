// The Lab's chunking explorer: three ways to cut a document (fixed-size, recursive, semantic), what each cut breaks,
// and whether the chunk retrieval returns still holds the whole answer. Chunks are character ranges into the text.
import { cosine as wordCosine, embed, idfFor } from "./ragToy";
import { cosine, type Vec } from "./vectors";

export interface Chunk {
  readonly start: number;
  readonly end: number;
}

/** A stretch of the text and the chunks that cover it: none (a gap), one, or several (an overlap). */
export interface Segment extends Chunk {
  readonly chunks: readonly number[];
}

export interface ChunkQuestion {
  readonly text: string;
  /** The sentence in SAMPLE_DOC that answers it. */
  readonly answer: string;
}

/** A short handbook for the made-up bike shop of "How RAG works": four topics, one per paragraph. */
export const SAMPLE_DOC = [
  "Returns and refunds. You can return any Orbit bike within 30 days of delivery for a full refund. The bike must come back with its original box and all accessories. Refunds go back to the original card within 5 working days of the return arriving.",
  "Warranty. Every Orbit frame has a 5-year warranty against cracks and weld failures. Brakes, tyres and chains wear out with use and are not covered by the warranty. To make a claim, send a photo of the damage and your order number to support.",
  "The E2 e-bike. The Orbit E2 is rated IPX5, so riding in rain is fine, but never pressure-wash the motor. A full charge of the E2 battery takes 4 hours and gives about 80 km of range. Store the battery indoors when it is below freezing.",
  "Delivery. Free delivery applies to orders above 500 TND; smaller orders pay 15 TND shipping. Bikes arrive almost fully assembled: you only fit the pedals and the handlebar.",
].join("\n\n");

export const CHUNK_QUESTIONS: readonly ChunkQuestion[] = [
  { text: "How many days do I have to return a bike?", answer: "You can return any Orbit bike within 30 days of delivery for a full refund." },
  { text: "How long does the E2 battery take to charge?", answer: "A full charge of the E2 battery takes 4 hours and gives about 80 km of range." },
  { text: "Are brakes covered by the warranty?", answer: "Brakes, tyres and chains wear out with use and are not covered by the warranty." },
];

/** The recursive splitter's separators, coarsest first: paragraph, line, sentence, word. A hard cut comes last. */
export const SEPARATORS = ["\n\n", "\n", ". ", " "] as const;
export const SEPARATOR_NAMES: Record<string, string> = { "\n\n": "paragraph", "\n": "line", ". ": "sentence", " ": "word", "": "hard cut" };

/** Every sentence, as a range: text up to . ! or ? (or a line break). A dot between digits ("3.5 km") is not an end. */
export function sentencesOf(text: string): Chunk[] {
  return [...text.matchAll(/\S(?:[^.!?\n]|\.(?=\d))*(?:[.!?]+|(?=\r?\n)|$)/g)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/** A cut is clean when it falls at the start or end of the text, after a sentence, or at a line break. */
export function boundaryIsClean(text: string, i: number): boolean {
  if (i <= 0 || i >= text.length) return true;
  let j = i;
  while (j > 0 && text[j - 1] === " ") j--;
  if (j === 0) return true;
  return ".!?\n\r".includes(text[j - 1]) || text[i] === "\n" || text[i] === "\r";
}

/** Cut every `size` characters; each chunk starts `overlap` characters before the previous one ended. */
export function fixedChunks(text: string, size: number, overlap: number): Chunk[] {
  if (size < 1) throw new Error(`Chunk size must be at least 1, got ${size}`);
  const step = Math.max(1, size - Math.max(0, overlap));
  const chunks: Chunk[] = [];
  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + size, text.length);
    chunks.push({ start, end });
    if (end === text.length) break;
  }
  return chunks;
}

/** Split [start, end) at `sep`, keeping each separator at the end of the piece before it. */
function splitKeeping(text: string, start: number, end: number, sep: string): Chunk[] {
  const pieces: Chunk[] = [];
  let from = start;
  for (let at = text.indexOf(sep, from); at !== -1 && at < end; at = text.indexOf(sep, from)) {
    pieces.push({ start: from, end: at + sep.length });
    from = at + sep.length;
  }
  if (from < end) pieces.push({ start: from, end });
  return pieces;
}

interface Pieces {
  readonly pieces: Chunk[];
  /** Separators that made a cut, at any level ("" for a hard cut). */
  readonly cuts: string[];
}

/**
 * Pieces no longer than `size`, each split at the coarsest separator that works. A piece's own trailing
 * separator doesn't count (a paragraph ending in a blank line has no line break inside it).
 */
function piecesOf(text: string, start: number, end: number, size: number, level: number): Pieces {
  if (end - start <= size) return { pieces: [{ start, end }], cuts: [] };
  const body = text.slice(start, end).replace(/\s+$/, "");
  const sep = SEPARATORS.slice(level).find((s) => body.includes(s));
  if (sep === undefined) {
    return { pieces: fixedChunks(text.slice(start, end), size, 0).map((c) => ({ start: start + c.start, end: start + c.end })), cuts: [""] };
  }
  const next = SEPARATORS.indexOf(sep) + 1;
  const parts = splitKeeping(text, start, end, sep).map((p) => (p.end - p.start > size ? piecesOf(text, p.start, p.end, size, next) : { pieces: [p], cuts: [] }));
  return { pieces: parts.flatMap((r) => r.pieces), cuts: [sep, ...parts.flatMap((r) => r.cuts)] };
}

function trimmed(text: string, c: Chunk): Chunk {
  let { start, end } = c;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return { start, end };
}

/**
 * LangChain-style recursive splitting: cut at paragraphs, then lines, sentences, words, then characters,
 * merging neighbouring pieces up to `size`. Overlap repeats the previous chunk's last pieces, up to `overlap` characters.
 */
export function recursiveSplit(text: string, size: number, overlap: number): { readonly chunks: Chunk[]; readonly used: string[] } {
  const { pieces, cuts } = piecesOf(text, 0, text.length, size, 0);
  const chunks: Chunk[] = [];
  let current: Chunk[] = [];
  const length = (ps: readonly Chunk[]) => ps.reduce((n, p) => n + p.end - p.start, 0);
  const emit = () => {
    if (current.length) chunks.push(trimmed(text, { start: current[0].start, end: current[current.length - 1].end }));
  };
  for (const p of pieces) {
    if (current.length && length(current) + p.end - p.start > size) {
      emit();
      while (current.length && (length(current) > overlap || length(current) + p.end - p.start > size)) current = current.slice(1);
    }
    current = [...current, p];
  }
  emit();
  // Coarsest first, with a hard cut (when even words were too long) last.
  const used: string[] = [...SEPARATORS.filter((s) => cuts.includes(s)), ...(cuts.includes("") ? [""] : [])];
  return { chunks: chunks.filter((c) => c.end > c.start), used };
}

export function recursiveChunks(text: string, size: number, overlap: number): Chunk[] {
  return recursiveSplit(text, size, overlap).chunks;
}

/** The value below which p percent of the values fall, interpolating between neighbours. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (Math.min(Math.max(p, 0), 100) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export interface SemanticResult {
  readonly chunks: Chunk[];
  /** Cosine distance between each sentence and the next. */
  readonly distances: number[];
  readonly threshold: number;
  /** Indexes of the distances above the threshold: a chunk ends after that sentence. */
  readonly breaks: number[];
}

/**
 * Semantic chunking: embed every sentence, measure the distance to the next one, and start a new chunk
 * wherever it is above the given percentile of all distances (the meaning shifts there).
 */
export function semanticChunks(text: string, sentenceVectors: readonly Vec[], breakpointPercentile: number): SemanticResult {
  const sentences = sentencesOf(text);
  if (sentenceVectors.length !== sentences.length) throw new Error(`Expected ${sentences.length} sentence vectors, got ${sentenceVectors.length}`);
  if (sentences.length === 0) return { chunks: [], distances: [], threshold: 0, breaks: [] };
  const distances = sentenceVectors.slice(1).map((v, i) => 1 - cosine(sentenceVectors[i], v));
  const threshold = percentile(distances, breakpointPercentile);
  const breaks = distances.flatMap((d, i) => (d > threshold ? [i] : []));
  const ends = [...breaks, sentences.length - 1];
  const chunks = ends.map((last, k) => ({ start: sentences[k === 0 ? 0 : ends[k - 1] + 1].start, end: sentences[last].end }));
  return { chunks, distances, threshold, breaks };
}

/** Cut the text at every chunk edge (and at any extra marks, such as where the answer starts and ends) and note which chunks cover each stretch. */
export function segmentsOf(length: number, chunks: readonly Chunk[], marks: readonly number[] = []): Segment[] {
  const inside = marks.filter((m) => m > 0 && m < length);
  const edges = [...new Set([0, length, ...inside, ...chunks.flatMap((c) => [c.start, c.end])])].sort((a, b) => a - b);
  return edges.slice(1).map((end, i) => {
    const start = edges[i];
    const covering = chunks.flatMap((c, k) => (c.start <= start && c.end >= end ? [k] : []));
    return { start, end, chunks: covering };
  });
}

export interface ChunkStats {
  readonly count: number;
  readonly averageLength: number;
  /** Chunk edges (inner ones only) that cut through a sentence. */
  readonly brokenCuts: number;
  readonly innerEdges: number;
}

export function chunkStats(text: string, chunks: readonly Chunk[]): ChunkStats {
  const inner = chunks.flatMap((c, i) => [...(i > 0 ? [c.start] : []), ...(i < chunks.length - 1 ? [c.end] : [])]);
  return {
    count: chunks.length,
    averageLength: chunks.length ? Math.round(chunks.reduce((n, c) => n + c.end - c.start, 0) / chunks.length) : 0,
    brokenCuts: inner.filter((i) => !boundaryIsClean(text, i)).length,
    innerEdges: inner.length,
  };
}

export type Verdict = "whole" | "missed" | "split" | "nothing" | "absent";

export interface AnswerCheck {
  /**
   * whole   the retrieved chunk holds the whole answer
   * missed  some chunk holds it, but retrieval returned another one
   * split   no chunk holds the whole answer: a cut runs through it
   * nothing retrieval found no chunk sharing a word with the question
   * absent  the answer isn't in the text (it was edited)
   */
  readonly verdict: Verdict;
  readonly chunks: readonly Chunk[];
  /** The chunk retrieval returns (toy word-overlap search), and its score; null when no chunk matches at all. */
  readonly top: number | null;
  readonly score: number;
  /** Chunks that contain part of the answer. */
  readonly spans: number[];
}

export function answerCheck(text: string, chunks: readonly Chunk[], q: ChunkQuestion): AnswerCheck {
  const texts = chunks.map((c) => text.slice(c.start, c.end));
  const idf = idfFor(texts);
  const qv = embed(q.text, idf);
  const scores = texts.map((t) => wordCosine(qv, embed(t, idf)));
  const best = scores.reduce((b, s, i) => (s > (scores[b] ?? -1) ? i : b), 0);
  const top = chunks.length && scores[best] > 0 ? best : null;
  const score = top === null ? 0 : scores[top];
  const a = text.indexOf(q.answer);
  if (a < 0) return { verdict: "absent", chunks, top, score, spans: [] };
  const b = a + q.answer.length;
  const holders = chunks.flatMap((c, i) => (c.start <= a && c.end >= b ? [i] : []));
  const spans = chunks.flatMap((c, i) => (c.start < b && c.end > a ? [i] : []));
  const verdict: Verdict = holders.length === 0 ? "split" : top === null ? "nothing" : holders.includes(top) ? "whole" : "missed";
  return { verdict, chunks, top, score, spans };
}
