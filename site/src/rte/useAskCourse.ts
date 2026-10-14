import { useCallback, useEffect, useRef, useState } from "react";
import { LECTURE_CHUNKS, noteChunks } from "../swc/logic/ask/coursePack";
import { searchableText, textHash, type Chunk, type PersonalNote } from "../swc/logic/ask/documents";
import { answerMessages, attribute, cleanStandalone, standaloneMessages, type Exchange } from "../swc/logic/ask/prompt";
import { bm25Index, retrieve, type Bm25Index, type RetrievalTrace } from "../swc/logic/ask/search";
import type { ChatMessage, LlmDevice } from "../swc/logic/lab/llm";
import type { Vec } from "../swc/logic/lab/vectors";
import { useRte } from "./RteContext";

/** Embeddings are cached per model and text, so changing the model invalidates the cache. */
const EMBED_MODEL = "all-MiniLM-L6-v2";
const BATCH = 16;
const TOP_K = 4;
const MAX_ANSWER_TOKENS = 220;

export interface AskTurn {
  readonly id: number;
  readonly question: string;
  /** What was actually searched: the question, or its standalone rewrite (lesson #7). */
  readonly searchQuery: string;
  readonly status: "searching" | "answering" | "done" | "error";
  /** All chunks searched for this turn (the trace points into it). */
  readonly pool: readonly Chunk[];
  readonly trace: RetrievalTrace | null;
  /** The chunks sent to the model, in citation order [1], [2], … */
  readonly sources: readonly Chunk[];
  readonly prompt: readonly ChatMessage[] | null;
  readonly answer: string;
  /** True when the [n] citations were added after generation by matching sentences to sources. */
  readonly citationsMatched: boolean;
  readonly error?: string;
}

export interface IndexStatus {
  readonly state: "building" | "ready" | "error";
  readonly embedded: number;
  readonly total: number;
  /** Embedding model download, first use only. */
  readonly modelPct: number | null;
}

export interface AiStatus {
  readonly state: "off" | "loading" | "ready" | "error";
  readonly pct: number | null;
  readonly device: LlmDevice | null;
}

export interface AskCourse {
  readonly notes: readonly PersonalNote[];
  readonly index: IndexStatus;
  readonly ai: AiStatus;
  readonly turns: readonly AskTurn[];
  readonly busy: boolean;
  /** Retrieve, and if answerWithAi, generate a grounded answer with the local model. */
  readonly ask: (question: string, answerWithAi: boolean) => Promise<void>;
  readonly stop: () => void;
  readonly clear: () => void;
  readonly addNotes: (notes: ReadonlyArray<{ readonly title: string; readonly text: string }>) => Promise<void>;
  readonly removeNote: (id: string) => Promise<void>;
}

interface Index {
  readonly chunks: readonly Chunk[];
  readonly bm25: Bm25Index;
  readonly vectors: readonly Vec[];
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function useAskCourse(): AskCourse {
  const { embedder, llm, library } = useRte();
  const [notes, setNotes] = useState<readonly PersonalNote[] | null>(null);
  const [index, setIndex] = useState<IndexStatus>({ state: "building", embedded: 0, total: LECTURE_CHUNKS.length, modelPct: null });
  const [ai, setAi] = useState<AiStatus>({ state: "off", pct: null, device: null });
  const [turns, setTurns] = useState<readonly AskTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const indexRef = useRef<Promise<Index> | null>(null);
  const turnId = useRef(0);
  const aiRef = useRef<Promise<LlmDevice> | null>(null);

  useEffect(() => {
    let active = true;
    void library.loadNotes().then((n) => {
      if (active) setNotes(n);
    });
    return () => {
      active = false;
    };
  }, [library]);

  // (Re)build the index whenever the notes change: lecture chunks + note chunks, embedded once and cached.
  useEffect(() => {
    if (notes === null) return;
    let active = true;
    const chunks = [...LECTURE_CHUNKS, ...noteChunks(notes)];
    const texts = chunks.map(searchableText);
    const keys = texts.map((t) => `${EMBED_MODEL}:${textHash(t)}`);
    setIndex({ state: "building", embedded: 0, total: chunks.length, modelPct: null });

    const build = (async (): Promise<Index> => {
      const cached = await library.getVectors(keys);
      const vectors: (Vec | undefined)[] = keys.map((k) => cached.get(k));
      const missing = vectors.flatMap((v, i) => (v ? [] : [i]));
      let embedded = chunks.length - missing.length;
      if (active) setIndex((s) => ({ ...s, embedded }));
      for (let start = 0; start < missing.length; start += BATCH) {
        const batch = missing.slice(start, start + BATCH);
        const out = await embedder.embed(batch.map((i) => texts[i]), (pct) => {
          if (active) setIndex((s) => ({ ...s, modelPct: pct }));
        });
        batch.forEach((i, j) => {
          vectors[i] = out[j];
        });
        await library.putVectors(new Map(batch.map((i, j) => [keys[i], out[j]] as const)));
        embedded += batch.length;
        if (active) setIndex((s) => ({ ...s, embedded, modelPct: null }));
      }
      return { chunks, bm25: bm25Index(texts), vectors: vectors as Vec[] };
    })();
    indexRef.current = build;
    build.then(
      () => active && setIndex((s) => ({ ...s, state: "ready", modelPct: null })),
      (err: unknown) => {
        console.error("Building the course index failed", err);
        if (active) setIndex((s) => ({ ...s, state: "error" }));
      },
    );
    return () => {
      active = false;
    };
  }, [notes, embedder, library]);

  const ensureAi = useCallback((): Promise<LlmDevice> => {
    aiRef.current ??= llm.load({
      onProgress: (pct) => setAi((s) => ({ ...s, state: "loading", pct })),
      onDevice: (device) => setAi((s) => ({ ...s, device })),
    }).then(
      (device) => {
        setAi({ state: "ready", pct: null, device });
        return device;
      },
      (err: unknown) => {
        aiRef.current = null;
        setAi((s) => ({ ...s, state: "error", pct: null }));
        throw err;
      },
    );
    setAi((s) => (s.state === "ready" ? s : { ...s, state: "loading" }));
    return aiRef.current;
  }, [llm]);

  const ask = useCallback(async (question: string, answerWithAi: boolean) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    const id = ++turnId.current;
    const update = (patch: Partial<AskTurn>) => setTurns((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const history: Exchange[] = turns.filter((t) => t.status === "done" && t.answer).map((t) => ({ question: t.question, answer: t.answer }));
    setTurns((cur) => [...cur, {
      id, question: q, searchQuery: q, status: "searching", pool: [], trace: null, sources: [], prompt: null, answer: "",
      citationsMatched: false,
    }]);

    try {
      // Lesson #7: a follow-up like "and its k?" is rewritten into a standalone question before searching.
      let searchQuery = q;
      if (answerWithAi && history.length > 0) {
        await ensureAi();
        searchQuery = cleanStandalone(await llm.generate(standaloneMessages(q, history), 48), q);
        update({ searchQuery });
      }

      const idx = await (indexRef.current ?? Promise.reject(new Error("The course index isn't ready")));
      const [queryVector] = await embedder.embed([searchQuery], () => undefined);
      const trace = retrieve(searchQuery, queryVector, idx.bm25, idx.vectors, { top: TOP_K });
      const sources = trace.picked.map((i) => idx.chunks[i]);
      update({ pool: idx.chunks, trace, sources, status: answerWithAi ? "answering" : "done" });
      if (!answerWithAi) return;

      await ensureAi();
      const prompt = answerMessages(q, sources, history);
      update({ prompt });
      const raw = await llm.generate(prompt, MAX_ANSWER_TOKENS, { onText: (text) => update({ answer: text }) });
      const cited = attribute(raw, sources);
      update({ answer: cited.text, citationsMatched: cited.added, status: "done" });
    } catch (err) {
      console.error("Ask the course failed", err);
      update({
        status: "error",
        error: "Something went wrong running the models here. A recent desktop browser (Chrome or Edge) works best.",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, turns, ensureAi, llm, embedder]);

  const addNotes = useCallback(async (incoming: ReadonlyArray<{ readonly title: string; readonly text: string }>) => {
    const fresh = incoming
      .filter((n) => n.text.trim())
      .map((n) => ({ id: newId(), title: n.title.trim() || "Untitled note", text: n.text, addedAt: new Date().toISOString() }));
    for (const n of fresh) await library.saveNote(n);
    setNotes((cur) => [...(cur ?? []), ...fresh]);
  }, [library]);

  const removeNote = useCallback(async (id: string) => {
    await library.deleteNote(id);
    setNotes((cur) => (cur ?? []).filter((n) => n.id !== id));
  }, [library]);

  return {
    notes: notes ?? [],
    index,
    ai,
    turns,
    busy,
    ask,
    stop: llm.stop,
    clear: () => setTurns([]),
    addNotes,
    removeNote,
  };
}
