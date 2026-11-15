// A toy RAG pipeline for the "What is RAG?" play: word vectors, cosine search, prompt assembly and a pretend model.
// Real systems use a neural embedder and a real LLM. This one counts words, so every number on screen can be checked by hand.

export interface DocChunk {
  readonly id: string;
  /** The file the chunk came from, shown as its citation. */
  readonly source: string;
  readonly text: string;
}

export interface Hit {
  readonly chunk: DocChunk;
  /** Cosine similarity with the question, 0 to 1. */
  readonly score: number;
}

export type WordVector = ReadonlyMap<string, number>;

export type Answer =
  | { readonly kind: "grounded"; readonly text: string; readonly source: string }
  | { readonly kind: "unknown"; readonly text: string }
  | { readonly kind: "guess"; readonly text: string };

export interface ExampleQuestion {
  readonly text: string;
  /** The document that answers it, or undefined when the documents don't cover it. */
  readonly expectedSource?: string;
  /** What a model without retrieval might say: plausible, confident and wrong. */
  readonly guess: string;
}

/** The private documents of a made-up bike shop: facts no LLM could have seen in training. */
export const KNOWLEDGE_BASE: readonly DocChunk[] = [
  { id: "returns-1", source: "returns.md", text: "You can return any Orbit bike within 30 days of delivery for a full refund." },
  { id: "returns-2", source: "returns.md", text: "Refunds go back to the original card within 5 working days of the return arriving." },
  { id: "warranty-1", source: "warranty.md", text: "Every Orbit frame has a 5-year warranty against cracks and weld failures." },
  { id: "warranty-2", source: "warranty.md", text: "Brakes, tyres and chains wear out with use and are not covered by the warranty." },
  { id: "ebike-1", source: "e2-manual.md", text: "The Orbit E2 is rated IPX5, so riding in rain is fine, but never pressure-wash the motor." },
  { id: "ebike-2", source: "e2-manual.md", text: "A full charge of the E2 battery takes 4 hours and gives about 80 km of range." },
  { id: "shop-1", source: "stores.md", text: "The Tunis store is open Monday to Saturday from 9:00 to 19:00." },
  { id: "shop-2", source: "stores.md", text: "Free delivery applies to orders above 500 TND; smaller orders pay 15 TND shipping." },
];

export const EXAMPLE_QUESTIONS: readonly ExampleQuestion[] = [
  { text: "How many days do I have to return a bike?", expectedSource: "returns.md", guess: "Most bike shops give you 14 days to return a bike." },
  { text: "How long is the frame warranty?", expectedSource: "warranty.md", guess: "Bike frames usually come with a 1-year warranty." },
  { text: "Can I ride the E2 in the rain?", expectedSource: "e2-manual.md", guess: "No. E-bikes should never get wet, so stay home when it rains." },
  { text: "Who won the 2026 Tour de France?", guess: "My training data stops before that race, but I'll name a famous rider anyway." },
];

const GENERIC_GUESS = "I haven't seen this shop's documents, so here is what is typical for most shops (it may be wrong).";
const UNKNOWN = "The documents don't cover this, so I don't know.";

/**
 * Below this similarity the best chunk is treated as unrelated, and the model says it doesn't know
 * instead of answering from a weak match. It is a low bar on purpose: the example answers score 0.37 to 0.59,
 * so it only stops answers built on a chunk that barely overlaps. Choosing it is a real tuning
 * decision (lesson #4, similarity score thresholds).
 */
export const MIN_SCORE = 0.15;

/** How many chunks retrieval hands to the model. Three fits the scene and is a common default. */
export const DEFAULT_TOP_K = 3;

const STOPWORDS = new Set(
  ("a an and are as at be by can do does for from has have how i in is it its my of on or so the their there this to " +
    "was what when where which who will with you your any long").split(" "),
);

/** Plural folding: "bikes" and "bike" are one word. Words ending in ss ("glass") are left alone. */
function stem(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOPWORDS.has(w)).map(stem);
}

/** Words that appear in every chunk tell chunks apart less, so they weigh less (inverse document frequency). */
export function idfFor(texts: readonly string[]): ReadonlyMap<string, number> {
  const docFreq = new Map<string, number>();
  for (const t of texts) for (const w of new Set(tokenize(t))) docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
  return new Map([...docFreq].map(([w, df]) => [w, 1 + Math.log(texts.length / df)]));
}

const KB_IDF = idfFor(KNOWLEDGE_BASE.map((c) => c.text));

/** The toy embedding: each word's count times its weight. Unknown words weigh 1. */
export function embed(text: string, idf: ReadonlyMap<string, number> = KB_IDF): WordVector {
  const counts = new Map<string, number>();
  for (const w of tokenize(text)) counts.set(w, (counts.get(w) ?? 0) + 1);
  return new Map([...counts].map(([w, n]) => [w, n * (idf.get(w) ?? 1)]));
}

function norm(v: WordVector): number {
  return Math.sqrt([...v.values()].reduce((sum, x) => sum + x * x, 0));
}

export function cosine(a: WordVector, b: WordVector): number {
  const denom = norm(a) * norm(b);
  if (denom === 0) return 0;
  const dot = [...a].reduce((sum, [w, x]) => sum + x * (b.get(w) ?? 0), 0);
  return dot / denom;
}

/** The k chunks most similar to the question, best first; chunks sharing no word with it are left out. */
export function retrieve(question: string, k: number = DEFAULT_TOP_K, chunks: readonly DocChunk[] = KNOWLEDGE_BASE): Hit[] {
  const q = embed(question);
  return chunks
    .map((chunk) => ({ chunk, score: cosine(q, embed(chunk.text)) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** The augmented prompt: instructions, numbered sources, then the question. */
export function buildPrompt(question: string, hits: readonly Hit[]): string {
  const context = hits.length
    ? hits.map((h, i) => `[${i + 1}] (${h.chunk.source}) ${h.chunk.text}`).join("\n")
    : "(no matching documents)";
  return [
    "Answer using only the sources below. Cite the source. If they don't contain the answer, say you don't know.",
    "",
    "Sources:",
    context,
    "",
    `Question: ${question}`,
  ].join("\n");
}

/**
 * The pretend model. With retrieval it repeats the best source (a real LLM would rephrase it);
 * without retrieval it can only guess from "training data".
 */
export function answer(question: string, hits: readonly Hit[], retrievalOn: boolean): Answer {
  if (!retrievalOn) {
    const known = EXAMPLE_QUESTIONS.find((e) => e.text === question.trim());
    return { kind: "guess", text: known?.guess ?? GENERIC_GUESS };
  }
  const best = hits[0];
  if (!best || best.score < MIN_SCORE) return { kind: "unknown", text: UNKNOWN };
  return { kind: "grounded", text: best.chunk.text, source: best.chunk.source };
}
