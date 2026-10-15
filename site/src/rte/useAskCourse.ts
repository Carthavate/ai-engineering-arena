import { useCallback, useEffect, useRef, useState } from "react";
import { LECTURE_CHUNKS, noteChunks } from "../swc/logic/ask/coursePack";
import { searchableText, textHash, type Chunk, type PersonalNote } from "../swc/logic/ask/documents";
import { answerMessages, attribute, cleanStandalone, standaloneMessages, stripCitations, type Exchange } from "../swc/logic/ask/prompt";
import { scopeIndex, type SearchIndex } from "../swc/logic/ask/scope";
import { bm25Index, retrieve, type RetrievalTrace } from "../swc/logic/ask/search";
import type { ChatMessage, LlmDevice } from "../swc/logic/lab/llm";
import type { Vec } from "../swc/logic/lab/vectors";
import { useRte } from "./RteContext";

/** Embeddings are cached per model and text; bump this if the embedding worker's model or settings change. */
const EMBED_MODEL = "all-MiniLM-L6-v2:q8";
const BATCH = 16;
const TOP_K = 4;
const MAX_ANSWER_TOKENS = 220;
/** Total size cap for personal notes, so indexing stays fast. */
export const MAX_NOTES_CHARS = 3_000_000;

export interface AskTurn {
  readonly id: number;
  readonly question: string;
  /** What was actually searched: the question, or its standalone rewrite (lesson #7). */
  readonly searchQuery: string;
  readonly status: "searching" | "answering" | "done" | "stopped" | "error";
  /** Whether this turn asked the local AI for an answer. */
  readonly usedAi: boolean;
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

export interface AddNotesResult {
  readonly added: number;
  readonly duplicates: number;
  /** Notes that couldn't be stored durably (blocked or full storage): kept until reload only. */
  readonly sessionOnly: number;
  readonly overLimit: number;
}

export interface AskOptions {
  /** Search only these sources: roadmap item ids (lectures) and note ids. Omitted: the whole course. */
  readonly sourceIds?: readonly string[];
}

export interface AskCourse {
  readonly notes: readonly PersonalNote[];
  readonly index: IndexStatus;
  readonly ai: AiStatus;
  readonly turns: readonly AskTurn[];
  readonly busy: boolean;
  /** Retrieve, and if answerWithAi, generate a grounded answer with the local model. */
  readonly ask: (question: string, answerWithAi: boolean, options?: AskOptions) => Promise<void>;
  /** Stop the current turn at its next step (and cut generation short). */
  readonly stop: () => void;
  readonly clear: () => void;
  readonly retryIndex: () => void;
  readonly addNotes: (notes: ReadonlyArray<{ readonly title: string; readonly text: string }>) => Promise<AddNotesResult>;
  readonly removeNote: (id: string) => Promise<void>;
  /** Re-read the notes from the library (e.g. after a lesson note was saved elsewhere) and re-index. */
  readonly reloadNotes: () => Promise<void>;
}

class Cancelled extends Error {}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function vectorKey(c: Chunk): string {
  return `${EMBED_MODEL}:${textHash(searchableText(c))}`;
}

/** Cache keys of a note's embeddings, to forget them when the note changes or goes away. */
export function noteVectorKeys(note: PersonalNote): string[] {
  return noteChunks([note]).map(vectorKey);
}

export function useAskCourse(): AskCourse {
  const { embedder, llm, library } = useRte();
  const [notes, setNotes] = useState<readonly PersonalNote[] | null>(null);
  const [index, setIndex] = useState<IndexStatus>({ state: "building", embedded: 0, total: LECTURE_CHUNKS.length, modelPct: null });
  const [rebuild, setRebuild] = useState(0);
  const [ai, setAi] = useState<AiStatus>({ state: "off", pct: null, device: null });
  const [turns, setTurns] = useState<readonly AskTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const notesRef = useRef<readonly PersonalNote[]>([]);
  const indexRef = useRef<Promise<SearchIndex> | null>(null);
  const turnId = useRef(0);
  const stoppedTurn = useRef(0);
  const aiRef = useRef<Promise<LlmDevice> | null>(null);

  useEffect(() => {
    let active = true;
    void library.loadNotes().then((n) => {
      if (!active) return;
      notesRef.current = n;
      setNotes(n);
    });
    return () => {
      active = false;
    };
  }, [library]);

  // Leaving the page stops a generation that is still running in the worker.
  useEffect(() => () => llm.stop(), [llm]);

  // (Re)build the index whenever the notes change: lecture chunks + note chunks, embedded once and cached.
  useEffect(() => {
    if (notes === null) return;
    let active = true;
    const chunks = [...LECTURE_CHUNKS, ...noteChunks(notes)];
    const texts = chunks.map(searchableText);
    const keys = chunks.map(vectorKey);
    setIndex({ state: "building", embedded: 0, total: chunks.length, modelPct: null });

    const build = (async (): Promise<SearchIndex> => {
      const cached = await library.getVectors(keys);
      const vectors: (Vec | undefined)[] = keys.map((k) => cached.get(k));
      const missing = vectors.flatMap((v, i) => (v ? [] : [i]));
      let embedded = chunks.length - missing.length;
      if (active) setIndex((s) => ({ ...s, embedded }));
      for (let start = 0; start < missing.length; start += BATCH) {
        // A newer build replaced this one (notes changed, or the page left): stop embedding for nothing.
        if (!active) throw new Cancelled();
        const batch = missing.slice(start, start + BATCH);
        const out = await embedder.embed(batch.map((i) => texts[i]), (pct) => {
          if (active) setIndex((s) => ({ ...s, modelPct: pct }));
        });
        // Replaced while embedding: don't cache vectors of text that may already be gone (e.g. an edited note).
        if (!active) throw new Cancelled();
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
        if (err instanceof Cancelled) return;
        console.error("Building the course index failed", err);
        if (active) setIndex((s) => ({ ...s, state: "error" }));
      },
    );
    return () => {
      active = false;
    };
  }, [notes, embedder, library, rebuild]);

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

  // The newest index. A build replaced mid-way (the notes changed) is cancelled: wait for its successor instead.
  const currentIndex = useCallback(async (): Promise<SearchIndex> => {
    for (;;) {
      const pending = indexRef.current ?? Promise.reject(new Error("index not started"));
      try {
        const index = await pending;
        if (indexRef.current === pending) return index;
      } catch (err) {
        if (!(err instanceof Cancelled) || indexRef.current === pending) throw err;
      }
    }
  }, []);

  const ask = useCallback(async (question: string, answerWithAi: boolean, options: AskOptions = {}) => {
    const q = question.trim();
    if (!q || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const id = ++turnId.current;
    const update = (patch: Partial<AskTurn>) => setTurns((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const check = () => {
      if (stoppedTurn.current === id) throw new Cancelled();
    };
    // Earlier answers go back into the prompt without their [n] markers: those pointed at other sources.
    const history: Exchange[] = turns
      .filter((t) => t.status === "done" && t.answer)
      .map((t) => ({ question: t.question, answer: stripCitations(t.answer) }));
    setTurns((cur) => [...cur, {
      id, question: q, searchQuery: q, status: "searching", usedAi: answerWithAi, pool: [], trace: null, sources: [],
      prompt: null, answer: "", citationsMatched: false,
    }]);

    try {
      // Lesson #7: a follow-up like "and its k?" is rewritten into a standalone question before searching.
      // The rewrite only improves search, so if it fails we simply search with the original question.
      let searchQuery = q;
      if (answerWithAi && history.length > 0) {
        try {
          await ensureAi();
          check();
          searchQuery = cleanStandalone(await llm.generate(standaloneMessages(q, history), 48), q);
          check();
          update({ searchQuery });
        } catch (err) {
          if (err instanceof Cancelled) throw err;
          console.error("Rewriting the follow-up failed; searching with the original question", err);
        }
      }

      const whole = await currentIndex();
      check();
      const idx = options.sourceIds ? scopeIndex(whole, new Set(options.sourceIds)) : whole;
      const [queryVector] = await embedder.embed([searchQuery], () => undefined);
      check();
      const trace = retrieve(searchQuery, queryVector, idx.bm25, idx.vectors, { top: TOP_K });
      const sources = trace.picked.map((i) => idx.chunks[i]);
      const willAnswer = answerWithAi && sources.length > 0;
      update({ pool: idx.chunks, trace, sources, status: willAnswer ? "answering" : "done" });
      if (!willAnswer) return;

      await ensureAi();
      check();
      const prompt = answerMessages(q, sources, history);
      update({ prompt });
      const raw = await llm.generate(prompt, MAX_ANSWER_TOKENS, { onText: (text) => update({ answer: text }) });
      const cited = attribute(raw, sources);
      update({ answer: cited.text, citationsMatched: cited.added, status: stoppedTurn.current === id ? "stopped" : "done" });
    } catch (err) {
      if (err instanceof Cancelled) {
        update({ status: "stopped" });
      } else {
        console.error("Ask the course failed", err);
        update({
          status: "error",
          error: index.state === "error"
            ? "The course index couldn't be built. Use Retry above, then ask again."
            : "Something went wrong running the models here. A recent desktop browser (Chrome or Edge) works best.",
        });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [turns, ensureAi, llm, embedder, index.state, currentIndex]);

  const stop = useCallback(() => {
    stoppedTurn.current = turnId.current;
    llm.stop();
  }, [llm]);

  const addNotes = useCallback(async (incoming: ReadonlyArray<{ readonly title: string; readonly text: string }>): Promise<AddNotesResult> => {
    const known = new Set(notesRef.current.map((n) => textHash(n.text.trim())));
    let used = notesRef.current.reduce((sum, n) => sum + n.text.length, 0);
    const fresh: PersonalNote[] = [];
    let duplicates = 0;
    let overLimit = 0;
    for (const n of incoming) {
      const text = n.text.trim();
      if (!text) continue;
      const hash = textHash(text);
      if (known.has(hash)) {
        duplicates += 1;
        continue;
      }
      if (used + text.length > MAX_NOTES_CHARS) {
        overLimit += 1;
        continue;
      }
      known.add(hash);
      used += text.length;
      fresh.push({ id: newId(), title: n.title.trim() || "Untitled note", text, addedAt: new Date().toISOString() });
    }
    let sessionOnly = 0;
    for (const n of fresh) {
      if (!(await library.saveNote(n))) sessionOnly += 1;
    }
    if (fresh.length > 0) {
      notesRef.current = [...notesRef.current, ...fresh];
      setNotes(notesRef.current);
    }
    return { added: fresh.length, duplicates, sessionOnly, overLimit };
  }, [library]);

  const removeNote = useCallback(async (id: string) => {
    const note = notesRef.current.find((n) => n.id === id);
    await library.deleteNote(id);
    if (note) await library.deleteVectors(noteVectorKeys(note));
    notesRef.current = notesRef.current.filter((n) => n.id !== id);
    setNotes(notesRef.current);
  }, [library]);

  const reloadNotes = useCallback(async () => {
    const fresh = await library.loadNotes();
    notesRef.current = fresh;
    setNotes(fresh);
  }, [library]);

  return {
    notes: notes ?? [],
    index,
    ai,
    turns,
    busy,
    ask,
    stop,
    clear: () => setTurns([]),
    retryIndex: () => setRebuild((n) => n + 1),
    addNotes,
    removeNote,
    reloadNotes,
  };
}
