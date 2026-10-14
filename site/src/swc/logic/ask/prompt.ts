// Prompts for "Ask the course": grounded answers with citations (lesson #6) and history-aware rewriting (lesson #7).
import type { ChatMessage } from "../lab/llm";
import { searchableText, type Chunk } from "./documents";
import { bm25Index, bm25Search } from "./search";

export interface Exchange {
  readonly question: string;
  readonly answer: string;
}

const SYSTEM =
  "You are a study assistant for a course on retrieval augmented generation. Answer the question using only the "
  + "numbered sources. Cite the sources you use like [1] or [2]. If the sources don't contain the answer, say you "
  + "don't know. Answer in at most 5 sentences.";

/** The grounded prompt: numbered sources, recent conversation, then the question. */
export function answerMessages(question: string, sources: readonly Chunk[], history: readonly Exchange[] = []): ChatMessage[] {
  // Plain numbered text: a 0.5B model copies titles and format examples back instead of answering.
  const context = sources.map((c, i) => `[${i + 1}] ${c.text.trim()}`).join("\n\n");
  const recent = history.slice(-2).flatMap((h): ChatMessage[] => [
    { role: "user", content: h.question },
    { role: "assistant", content: h.answer },
  ]);
  return [
    { role: "system", content: SYSTEM },
    ...recent,
    { role: "user", content: `Sources:\n${context || "(none found)"}\n\nQuestion: ${question.trim()}` },
  ];
}

/** Ask the model to turn a follow-up ("and its weights?") into a question that stands on its own. */
export function standaloneMessages(question: string, history: readonly Exchange[]): ChatMessage[] {
  const convo = history.slice(-2).map((h) => `User: ${h.question}\nAssistant: ${h.answer}`).join("\n");
  return [
    {
      role: "system",
      content: "Rewrite the user's last question so it can be understood without the conversation. "
        + "Reply with the rewritten question only, nothing else.",
    },
    { role: "user", content: `Conversation:\n${convo}\n\nLast question: ${question.trim()}` },
  ];
}

/** Keep the model's rewrite only if it looks like a single question; otherwise search with the original. */
export function cleanStandalone(rewrite: string, fallback: string): string {
  const line = rewrite.trim().split(/\r?\n/)[0].replace(/^(rewritten question|question)\s*:\s*/i, "").replace(/^["']|["']$/g, "").trim();
  return line.length >= 3 && line.length <= 300 ? line : fallback;
}

/** Source numbers cited in an answer, e.g. "see [1] and [3]" -> [1, 3]. */
export function citations(answer: string, sourceCount: number): number[] {
  const found = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= sourceCount);
  return [...new Set(found)].sort((a, b) => a - b);
}

/** Minimum BM25 overlap for a sentence to be credited to a source. */
const MIN_ATTRIBUTION = 1.5;

/** Remove [n] markers, e.g. from earlier answers before they go back into a prompt with new numbering. */
export function stripCitations(text: string): string {
  return text.replace(/\s?\[\d+\]/g, "");
}

/**
 * Post-hoc attribution: small models rarely cite reliably, so after generation each sentence is credited to
 * the source it overlaps most (BM25 over the sources sent to the model). Line breaks and list items are kept;
 * a list item counts as one unit. Answers that already cite valid sources are kept; invalid markers are removed.
 */
export function attribute(answer: string, sources: readonly Chunk[]): { readonly text: string; readonly added: boolean } {
  if (sources.length === 0) return { text: answer, added: false };
  const valid = answer.replace(/\s?\[(\d+)\]/g, (m, n: string) => (Number(n) >= 1 && Number(n) <= sources.length ? m : ""));
  if (citations(valid, sources.length).length > 0) return { text: valid, added: false };
  const index = bm25Index(sources.map(searchableText));
  let added = false;
  const credit = (unit: string): string => {
    const [best] = bm25Search(index, unit, 1);
    if (!best || best.score < MIN_ATTRIBUTION) return unit;
    added = true;
    const m = /^([\s\S]*?)([.!?:;]*\s*)$/.exec(unit)!;
    return `${m[1]} [${best.index + 1}]${m[2]}`;
  };
  const text = valid
    .split(/(\r?\n+)/)
    .map((line) => {
      if (!line.trim()) return line;
      if (/^\s*(?:[-*•]|\d+[.)])\s/.test(line)) return credit(line);
      // Sentences: text up to . ! ? followed by a space or the end of the line.
      return (line.match(/[^.!?]+(?:[.!?]+(?=\s|$)\s*|$)/g) ?? [line]).map(credit).join("");
    })
    .join("");
  return { text, added };
}
