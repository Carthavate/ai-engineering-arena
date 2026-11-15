import { describe, expect, it } from "vitest";
import { peekOf, PEEK_ROWS } from "./ragPeek";
import { DEFAULT_TOP_K, EXAMPLE_QUESTIONS, KNOWLEDGE_BASE } from "./ragToy";

const on = { question: EXAMPLE_QUESTIONS[0].text, retrievalOn: true };
const off = { ...on, retrievalOn: false };

describe("peekOf", () => {
  it("lists each document once, with its chunk count", () => {
    const p = peekOf("docs", on);
    if (p.kind !== "files") throw new Error(p.kind);
    expect(p.files.map((f) => f.name)).toEqual(["returns.md", "warranty.md", "e2-manual.md", "stores.md"]);
    expect(p.files.reduce((n, f) => n + f.chunks, 0)).toBe(KNOWLEDGE_BASE.length);
  });

  it("shows the chunks of the document the question is about", () => {
    const p = peekOf("chunker", { question: "How long is the frame warranty?", retrievalOn: true });
    if (p.kind !== "chunks") throw new Error(p.kind);
    expect(p.source).toBe("warranty.md");
    expect(p.chunks).toHaveLength(2);
    expect(p.total).toBe(KNOWLEDGE_BASE.length);
  });

  it("shows the question's heaviest words as its vector", () => {
    const p = peekOf("embedder", on);
    if (p.kind !== "vector") throw new Error(p.kind);
    expect(p.text).toBe(on.question);
    expect(p.words.map(([w]) => w)).toContain("return");
    expect(p.words[0][1]).toBeGreaterThanOrEqual(p.words[p.words.length - 1][1]);
  });

  it("ranks the stored rows by similarity and marks the top k when retrieval is on", () => {
    const p = peekOf("vectordb", on);
    if (p.kind !== "rows") throw new Error(p.kind);
    expect(p.rows).toHaveLength(PEEK_ROWS);
    expect(p.total).toBe(KNOWLEDGE_BASE.length);
    expect(p.rows[0].id).toBe("returns-1");
    const scores = p.rows.map((r) => r.score ?? 0);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(p.rows.filter((r) => r.hit).length).toBeLessThanOrEqual(DEFAULT_TOP_K);
  });

  it("shows the stored rows unscored when retrieval is off", () => {
    const p = peekOf("vectordb", off);
    if (p.kind !== "rows") throw new Error(p.kind);
    expect(p.rows[0].id).toBe(KNOWLEDGE_BASE[0].id);
    expect(p.rows.every((r) => r.score === undefined && !r.hit)).toBe(true);
  });

  it("shows the prompt with sources only when retrieval is on", () => {
    const withRag = peekOf("prompt", on);
    const without = peekOf("prompt", off);
    if (withRag.kind !== "prompt" || without.kind !== "prompt") throw new Error("not a prompt");
    expect(withRag.sources).toBeGreaterThan(0);
    expect(withRag.text).toContain("Sources:");
    expect(without).toEqual({ kind: "prompt", text: `Question: ${on.question}`, sources: 0 });
  });

  it("describes what the model reads", () => {
    expect(peekOf("llm", on)).toMatchObject({ kind: "model", retrievalOn: true });
    expect(peekOf("llm", off)).toMatchObject({ kind: "model", retrievalOn: false });
  });

  it("gives the grounded answer, or the guess without retrieval", () => {
    expect(peekOf("answer", on)).toMatchObject({ kind: "answer", answer: { kind: "grounded" } });
    expect(peekOf("answer", off)).toMatchObject({ kind: "answer", answer: { kind: "guess" } });
  });

  it("shows the question as asked", () => {
    expect(peekOf("question", on)).toEqual({ kind: "question", text: on.question });
  });
});
