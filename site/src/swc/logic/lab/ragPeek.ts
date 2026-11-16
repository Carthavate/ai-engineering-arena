// "Peek inside": what each part of the RAG drawing holds right now, for the current question.
// Everything comes from the toy pipeline, so the previews match what Try it computes.
import type { PartId } from "./ragTour";
import { answer, buildPrompt, cosine, DEFAULT_TOP_K, embed, KNOWLEDGE_BASE, retrieve, type Answer } from "./ragToy";

export interface PeekState {
  readonly question: string;
  readonly retrievalOn: boolean;
}

export interface PeekFile {
  readonly name: string;
  readonly chunks: number;
  readonly first: string;
}

export interface PeekRow {
  readonly id: string;
  readonly text: string;
  /** Similarity with the question; only when retrieval runs. */
  readonly score?: number;
  /** Among the top k handed to the model. */
  readonly hit: boolean;
}

export type Peek =
  | { readonly kind: "files"; readonly files: readonly PeekFile[] }
  | { readonly kind: "chunks"; readonly source: string; readonly chunks: readonly string[]; readonly total: number }
  | { readonly kind: "vector"; readonly text: string; readonly words: readonly (readonly [string, number])[] }
  | { readonly kind: "rows"; readonly rows: readonly PeekRow[]; readonly total: number }
  | { readonly kind: "question"; readonly text: string }
  | { readonly kind: "prompt"; readonly text: string; readonly sources: number }
  | { readonly kind: "model"; readonly retrievalOn: boolean; readonly inputWords: number }
  | { readonly kind: "answer"; readonly answer: Answer };

/** Rows of the vector database shown in its preview; the rest are counted. Five fit a small card. */
export const PEEK_ROWS = 5;
/** Words of the question vector shown in the embedder's preview. */
const PEEK_WORDS = 6;

function files(): PeekFile[] {
  const names = [...new Set(KNOWLEDGE_BASE.map((c) => c.source))];
  return names.map((name) => {
    const own = KNOWLEDGE_BASE.filter((c) => c.source === name);
    return { name, chunks: own.length, first: own[0].text };
  });
}

function rows({ question, retrievalOn }: PeekState): PeekRow[] {
  if (!retrievalOn) return KNOWLEDGE_BASE.slice(0, PEEK_ROWS).map((c) => ({ id: c.id, text: c.text, hit: false }));
  const q = embed(question);
  return KNOWLEDGE_BASE
    .map((c) => ({ id: c.id, text: c.text, score: cosine(q, embed(c.text)) }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, hit: i < DEFAULT_TOP_K && r.score > 0 }))
    .slice(0, PEEK_ROWS);
}

/** What the part holds for this question. */
export function peekOf(id: PartId, state: PeekState): Peek {
  const { question, retrievalOn } = state;
  const hits = retrievalOn ? retrieve(question) : [];
  switch (id) {
    case "docs":
      return { kind: "files", files: files() };
    case "chunker": {
      const source = retrieve(question, 1)[0]?.chunk.source ?? KNOWLEDGE_BASE[0].source;
      const chunks = KNOWLEDGE_BASE.filter((c) => c.source === source).map((c) => c.text);
      return { kind: "chunks", source, chunks, total: KNOWLEDGE_BASE.length };
    }
    case "embedder":
      return { kind: "vector", text: question, words: [...embed(question)].sort((a, b) => b[1] - a[1]).slice(0, PEEK_WORDS) };
    case "vectordb":
      return { kind: "rows", rows: rows(state), total: KNOWLEDGE_BASE.length };
    case "question":
      return { kind: "question", text: question };
    case "prompt":
      return retrievalOn
        ? { kind: "prompt", text: buildPrompt(question, hits), sources: hits.length }
        : { kind: "prompt", text: `Question: ${question}`, sources: 0 };
    case "llm": {
      const prompt = retrievalOn ? buildPrompt(question, hits) : question;
      return { kind: "model", retrievalOn, inputWords: prompt.split(/\s+/).filter(Boolean).length };
    }
    case "answer":
      return { kind: "answer", answer: answer(question, hits, retrievalOn) };
  }
}
