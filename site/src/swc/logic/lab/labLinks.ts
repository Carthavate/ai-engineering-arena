// Which Lab pages go with which lesson: hand-picked explorers, plus every coding challenge that practises the lesson.
import { CHALLENGES, type Challenge, type Level } from "./challenges";

/** The Lab's explore pages (route ids and names). Challenges are linked separately, from their own `item`. */
export const LAB_TOOLS = {
  "how-rag-works": "How RAG works",
  chunking: "Chunking",
  "hybrid-search": "Hybrid search",
  playground: "Embeddings & RAG",
  tokenizer: "Tokenizers",
} as const;

export type LabTool = keyof typeof LAB_TOOLS;

export interface Explorer {
  readonly tool: LabTool;
  /** What to do there, for this lesson. */
  readonly why: string;
}

/** Lessons whose ideas you can poke at in an explore page, by roadmap item id. */
export const EXPLORERS: Readonly<Record<string, readonly Explorer[]>> = {
  "rag-1": [{ tool: "how-rag-works", why: "Inspect each part of a RAG system, step through indexing and query time, then switch retrieval off and watch the model guess." }],
  "rag-2": [
    { tool: "playground", why: "Sentence similarity: embed your own sentences and see which ones land close together." },
    { tool: "how-rag-works", why: "See the ingestion pipeline and the retrieval pipeline side by side." },
  ],
  "rag-3": [
    { tool: "chunking", why: "Drag chunk size and overlap and watch fixed-size cuts break sentences, then check whether the answer survives." },
    { tool: "playground", why: "Mini RAG: chunk your own text and see which chunks a real embedding model retrieves." },
  ],
  "rag-4": [{ tool: "playground", why: "Mini RAG: ask a question and see the top-k chunks a retriever returns, with their scores." }],
  "rag-5": [{ tool: "playground", why: "Sentence similarity: compare cosine scores between your own sentences." }],
  "rag-6": [
    { tool: "playground", why: "Mini RAG: retrieve chunks, then let a small LLM in your browser answer from them." },
    { tool: "how-rag-works", why: "Try it: ask a question the documents don't cover and see the grounded \"I don't know\"." },
  ],
  "rag-8": [
    { tool: "chunking", why: "Cut the same document fixed-size, recursive and semantic, and compare what each cut breaks." },
    { tool: "playground", why: "Mini RAG: try small and large chunk sizes on the same text and compare what gets retrieved." },
  ],
  "rag-9": [{ tool: "chunking", why: "Recursive mode: see which separators (paragraph, line, sentence, word) the splitter falls back to as chunks shrink." }],
  "rag-10": [{ tool: "chunking", why: "Semantic mode: embed every sentence, see the distance chart, and move the breakpoint percentile." }],
  "rag-14": [{ tool: "hybrid-search", why: "Multi-query merges several ranked lists: see reciprocal rank fusion do it, rank by rank." }],
  "rag-15": [{ tool: "hybrid-search", why: "Fuse a BM25 list and a vector list with 1/(k + rank), see every score's arithmetic, and drag k." }],
  "rag-16": [{ tool: "hybrid-search", why: "Watch BM25 score each word (rarity × saturation), tune k1 and b, and see where keywords beat vectors and where they lose." }],
  "p3-4": [{ tool: "tokenizer", why: "Type anything and watch real tokenizers (GPT, Llama and more) chop it into tokens." }],
  "p4-4": [{ tool: "playground", why: "Embed sentences in your browser and see vector search ranking them." }],
};

export type LabLink =
  | { readonly kind: "explore"; readonly lab: LabTool; readonly title: string; readonly why: string }
  | { readonly kind: "challenge"; readonly lab: string; readonly title: string; readonly level: Level; readonly xp: number };

/** The Lab pages that go with a lesson: explorers first, then its coding challenges. */
export function labLinksFor(itemId: string, challenges: readonly Challenge[] = CHALLENGES): LabLink[] {
  const explore: LabLink[] = (EXPLORERS[itemId] ?? []).map((e) => ({ kind: "explore", lab: e.tool, title: LAB_TOOLS[e.tool], why: e.why }));
  const practise: LabLink[] = challenges
    .filter((c) => c.item === itemId)
    .map((c) => ({ kind: "challenge", lab: c.id, title: c.title, level: c.level, xp: c.xp }));
  return [...explore, ...practise];
}
