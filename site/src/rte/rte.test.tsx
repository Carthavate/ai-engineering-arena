// @vitest-environment jsdom
// The RTE makes hooks testable without a database: wire fake ports, drive them, check the state.
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { fail, ok, type ChallengeSolve } from "../swc/logic/types";
import type { ProgressRow } from "../swc/logic/progress";
import type { Rte } from "./ports";
import { RteProvider } from "./RteContext";
import { useProgress } from "./useProgress";
import { useSolves } from "./useSolves";
import { useAskCourse } from "./useAskCourse";

/** A fake Rte: only the ports a test touches need real behavior. */
function fakeRte(overrides: Partial<Rte>): Rte {
  const unused = new Proxy({}, { get: () => () => { throw new Error("port not faked in this test"); } });
  return { configured: true, ...(Object.fromEntries(
    ["auth", "progress", "quizzes", "duels", "live", "players", "solves", "python", "kernel", "embedder", "tokenizer", "llm", "library"]
      .map((k) => [k, unused]),
  ) as unknown as Omit<Rte, "configured">), ...overrides };
}

const wrapper = (rte: Rte) => ({ children }: { children: ReactNode }) => <RteProvider rte={rte}>{children}</RteProvider>;

describe("useSolves through the SolvesPort", () => {
  it("loads, merges pushed solves without duplicates, and records", async () => {
    let push: (s: ChallengeSolve) => void = () => undefined;
    const recorded: string[] = [];
    const rte = fakeRte({
      solves: {
        load: async () => ok([{ user_id: "a", challenge_id: "bm25", solved_at: "t1" }]),
        watch: (cb) => { push = cb; return () => undefined; },
        record: async (_u, c) => { recorded.push(c); return ok(null); },
      },
    });
    const { result } = renderHook(() => useSolves(), { wrapper: wrapper(rte) });
    await waitFor(() => expect(result.current.solves).toHaveLength(1));

    act(() => push({ user_id: "a", challenge_id: "bm25", solved_at: "t1" }));
    act(() => push({ user_id: "b", challenge_id: "rrf", solved_at: "t2" }));
    expect(result.current.solves.map((s) => s.challenge_id)).toEqual(["bm25", "rrf"]);

    await act(async () => { await result.current.record("a", "mmr"); });
    expect(recorded).toEqual(["mmr"]);
    expect(result.current.solves.some((s) => s.challenge_id === "mmr")).toBe(true);
  });
});

describe("useProgress through the ProgressPort", () => {
  it("marks done optimistically and rolls back with the port's message on failure", async () => {
    const rows: ProgressRow[] = [];
    const rte = fakeRte({
      progress: {
        loadMembers: async () => ok([]),
        loadProgress: async () => ok(rows),
        watchProgress: () => () => undefined,
        watchMembers: () => () => undefined,
        markDone: async (_u, item) => (item === "rag-1" ? ok(null) : fail("Pass the quiz first")),
      },
    });
    const { result } = renderHook(() => useProgress(), { wrapper: wrapper(rte) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.markDone("u", "rag-1"); });
    expect("rag-1" in (result.current.progress.u ?? {})).toBe(true);

    await act(async () => { await result.current.markDone("u", "rag-2"); });
    expect("rag-2" in (result.current.progress.u ?? {})).toBe(false);
    expect(result.current.error).toBe("Pass the quiz first");
  });
});

describe("useAskCourse through fake models", () => {
  // A toy embedding: one dimension per keyword, so similar wording gives similar vectors.
  const VOCAB = ["rank", "fusion", "bm25", "keyword", "cosine", "chunk", "overlap", "rerank", "my"];
  const toyEmbed = (t: string) => VOCAB.map((w) => (t.toLowerCase().includes(w) ? 1 : 0.01));

  function rteWithModels(calls: { embedded: number; generated: string[] }) {
    const store = new Map<string, readonly number[]>();
    return fakeRte({
      embedder: {
        embed: async (texts) => {
          calls.embedded += texts.length;
          return texts.map(toyEmbed);
        },
      },
      llm: {
        load: async () => "wasm",
        generate: async (messages, _max, cb) => {
          const last = messages.at(-1)!.content;
          calls.generated.push(last);
          const text = last.startsWith("Conversation:") ? "What is the k constant in reciprocal rank fusion?" : "RRF adds 1/(k+rank) [1].";
          cb?.onText?.(text);
          return text;
        },
        stop: () => undefined,
      },
      library: {
        loadNotes: async () => [],
        saveNote: async () => true,
        deleteNote: async () => undefined,
        deleteVectors: async (keys) => keys.forEach((k) => store.delete(k)),
        getVectors: async (keys) => new Map(keys.flatMap((k) => (store.has(k) ? [[k, store.get(k)!] as const] : []))),
        putVectors: async (entries) => entries.forEach((v, k) => store.set(k, v)),
      },
    });
  }

  it("indexes the lectures once, retrieves the RRF lecture and answers with citations", async () => {
    const calls = { embedded: 0, generated: [] as string[] };
    const rte = rteWithModels(calls);
    const { result } = renderHook(() => useAskCourse(), { wrapper: wrapper(rte) });
    await waitFor(() => expect(result.current.index.state).toBe("ready"));
    expect(result.current.index.embedded).toBe(result.current.index.total);

    await act(async () => { await result.current.ask("How does reciprocal rank fusion work?", true); });
    const turn = result.current.turns[0];
    expect(turn.status).toBe("done");
    expect(turn.sources.some((c) => c.sourceId === "rag-15")).toBe(true);
    expect(turn.trace?.keyword.length).toBeGreaterThan(0);
    expect(turn.answer).toBe("RRF adds 1/(k+rank) [1].");
    expect(turn.prompt?.at(-1)?.content).toMatch(/^Sources:\n\[1\]/);
  });

  it("rewrites a follow-up into a standalone question before searching (lesson #7)", async () => {
    const calls = { embedded: 0, generated: [] as string[] };
    const { result } = renderHook(() => useAskCourse(), { wrapper: wrapper(rteWithModels(calls)) });
    await waitFor(() => expect(result.current.index.state).toBe("ready"));
    await act(async () => { await result.current.ask("What is reciprocal rank fusion?", true); });
    await act(async () => { await result.current.ask("and its k?", true); });
    expect(result.current.turns[1].searchQuery).toBe("What is the k constant in reciprocal rank fusion?");
  });

  it("can search without the AI, and adds personal notes to the index", async () => {
    const calls = { embedded: 0, generated: [] as string[] };
    const { result } = renderHook(() => useAskCourse(), { wrapper: wrapper(rteWithModels(calls)) });
    await waitFor(() => expect(result.current.index.state).toBe("ready"));
    const lectures = result.current.index.total;

    await act(async () => { await result.current.addNotes([{ title: "My BM25 notes", text: "## keyword\nmy bm25 cheat sheet" }]); });
    await waitFor(() => expect(result.current.index.total).toBe(lectures + 1));
    await waitFor(() => expect(result.current.index.state).toBe("ready"));

    await act(async () => { await result.current.ask("my bm25 keyword notes", false); });
    const turn = result.current.turns[0];
    expect(turn.status).toBe("done");
    expect(turn.answer).toBe("");
    expect(turn.sources[0].kind).toBe("note");
    expect(calls.generated).toHaveLength(0);
  });
});

describe("useAskCourse controls", () => {
  const toy = (t: string) => ["rank", "fusion", "chunk", "overlap"].map((w) => (t.toLowerCase().includes(w) ? 1 : 0.01));

  it("stops a turn before generation starts, and skips duplicate notes", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    let generated = 0;
    const rte = fakeRte({
      embedder: { embed: async (texts) => texts.map(toy) },
      llm: {
        load: async () => { await gate; return "wasm"; },
        generate: async () => { generated += 1; return "x"; },
        stop: () => undefined,
      },
      library: {
        loadNotes: async () => [],
        saveNote: async () => false,
        deleteNote: async () => undefined,
        deleteVectors: async () => undefined,
        getVectors: async () => new Map(),
        putVectors: async () => undefined,
      },
    });
    const { result } = renderHook(() => useAskCourse(), { wrapper: wrapper(rte) });
    await waitFor(() => expect(result.current.index.state).toBe("ready"));

    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.ask("How does reciprocal rank fusion work?", true); });
    await waitFor(() => expect(result.current.turns[0]?.status).toBe("answering"));
    act(() => result.current.stop());
    await act(async () => { release(); await pending; });
    expect(result.current.turns[0].status).toBe("stopped");
    expect(generated).toBe(0);

    let r = await act(async () => result.current.addNotes([{ title: "a", text: "chunk overlap notes" }, { title: "b", text: "chunk overlap notes" }]));
    expect(r).toMatchObject({ added: 1, duplicates: 1, sessionOnly: 1 });
    r = await act(async () => result.current.addNotes([{ title: "c", text: "  chunk overlap notes " }]));
    expect(r).toMatchObject({ added: 0, duplicates: 1 });
  });
});
