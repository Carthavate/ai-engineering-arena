import { describe, expect, it, vi } from "vitest";
import type { PersonalNote } from "../../swc/logic/ask/documents";
import { callbackMessage, isAuthMessage } from "./authMessage";
import { hostError, type AnnaHost, type HostMessage } from "./host";
import { annaLibrary } from "./library";
import { annaEmbedder, annaLlm } from "./models";

/** An in-memory Anna host: storage is a Map, the models are scripted per test. */
function fakeHost(overrides: { complete?: AnnaHost["llm"]["complete"]; embed?: AnnaHost["llm"]["embed"] } = {}) {
  const store = new Map<string, unknown>();
  const host: AnnaHost = {
    llm: {
      complete: overrides.complete ?? (async () => ({ content: { type: "text", text: "ok" }, stopReason: "endTurn" })),
      embed: overrides.embed ?? (async ({ input }) => ({ data: input.map((t, index) => ({ index, embedding: [t.length] })) })),
    },
    storage: {
      get: async ({ key }) => ({ value: store.get(key), exists: store.has(key) }),
      set: async ({ key, value }) => { store.set(key, value); return {}; },
      delete: async ({ key }) => { store.delete(key); return {}; },
      list: async ({ prefix, cursor }) => {
        const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
        const start = cursor ? Number(cursor) : 0;
        const page = keys.slice(start, start + 2);
        return { items: page.map((key) => ({ key })), next_cursor: start + 2 < keys.length ? String(start + 2) : null };
      },
    },
  };
  return { host, store };
}

describe("annaLlm", () => {
  it("sends system messages as the system prompt and returns the text", async () => {
    const calls: { messages: readonly HostMessage[]; systemPrompt?: string; maxTokens?: number }[] = [];
    const { host } = fakeHost({
      complete: async (args) => { calls.push(args); return { content: { type: "text", text: "RRF adds 1/(k+rank) [1]." }, stopReason: "endTurn" }; },
    });
    const llm = annaLlm(host);
    const onText = vi.fn();
    expect(await llm.load()).toBe("host");
    const text = await llm.generate([{ role: "system", content: "Cite [1]." }, { role: "user", content: "What is RRF?" }], 160, { onText });
    expect(text).toBe("RRF adds 1/(k+rank) [1].");
    expect(onText).toHaveBeenCalledWith("RRF adds 1/(k+rank) [1].");
    expect(calls[0]).toMatchObject({ systemPrompt: "Cite [1].", maxTokens: 160, messages: [{ role: "user", content: "What is RRF?" }] });
  });

  it("stop drops an answer that's still on its way", async () => {
    const { host } = fakeHost({ complete: () => new Promise(() => undefined) });
    const llm = annaLlm(host);
    const pending = llm.generate([{ role: "user", content: "Hi" }], 50);
    llm.stop();
    expect(await pending).toBe("");
  });

  it("turns Anna's errors into player-facing messages", async () => {
    const { host } = fakeHost({ complete: async () => { throw { code: "APP_QUOTA_EXCEEDED" }; } });
    await expect(annaLlm(host).generate([{ role: "user", content: "Hi" }], 50)).rejects.toThrow(/Anna credits are used up/);
  });
});

describe("hostError", () => {
  it("explains the common codes and falls back to a generic message", () => {
    expect(hostError({ code: "APP_NOT_GRANTED" }, "X").message).toMatch(/install or enable the app/);
    expect(hostError(new Error("boom"), "X").message).toMatch(/didn't answer/);
  });
});

describe("annaEmbedder", () => {
  it("embeds in batches of 64, keeps the order and reports progress", async () => {
    const batches: number[] = [];
    const { host } = fakeHost({
      embed: async ({ input }) => {
        batches.push(input.length);
        // Anna may return the vectors in any order: each carries its index.
        return { data: input.map((t, index) => ({ index, embedding: [t.length] })).reverse() };
      },
    });
    const texts = Array.from({ length: 70 }, (_, i) => "x".repeat(i + 1));
    const progress: number[] = [];
    const vectors = await annaEmbedder(host).embed(texts, (pct) => progress.push(pct));
    expect(batches).toEqual([64, 6]);
    expect(vectors.map((v) => v[0])).toEqual(texts.map((t) => t.length));
    expect(progress).toEqual([91, 100]);
  });

  it("fails when Anna returns the wrong number of vectors", async () => {
    const { host } = fakeHost({ embed: async () => ({ data: [] }) });
    await expect(annaEmbedder(host).embed(["a"], () => undefined)).rejects.toThrow(/wrong number/);
  });
});

describe("annaLibrary", () => {
  const note = (id: string, addedAt: string): PersonalNote => ({ id, title: `Note ${id}`, text: "text", addedAt });

  it("keeps notes in the app's Anna storage under safe keys, across pages", async () => {
    const { host, store } = fakeHost();
    const library = annaLibrary(host);
    expect(await library.saveNote(note("lesson:rag-1", "2026-11-02"))).toBe(true);
    await library.saveNote(note("b", "2026-11-01"));
    await library.saveNote(note("c", "2026-11-03"));
    store.set("notes/broken", { id: 1 });
    expect([...store.keys()]).toContain("notes/lesson%3Arag-1");
    expect((await library.loadNotes()).map((n) => n.id)).toEqual(["b", "lesson:rag-1", "c"]);
    await library.deleteNote("lesson:rag-1");
    expect((await library.loadNotes()).map((n) => n.id)).toEqual(["b", "c"]);
  });

  it("reports a note it couldn't store", async () => {
    const { host } = fakeHost();
    const failing: AnnaHost = { ...host, storage: { ...host.storage, set: async () => { throw new Error("quota"); } } };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await annaLibrary(failing).saveNote(note("a", "2026-11-01"))).toBe(false);
  });

  it("keeps embeddings in memory only", async () => {
    const { host, store } = fakeHost();
    const library = annaLibrary(host);
    await library.putVectors(new Map([["k1", [1, 2]], ["k2", [3]]]));
    expect([...(await library.getVectors(["k1", "missing"])).keys()]).toEqual(["k1"]);
    await library.deleteVectors(["k1"]);
    expect((await library.getVectors(["k1"])).size).toBe(0);
    expect(store.size).toBe(0);
  });
});

describe("the sign-in callback message", () => {
  const base = "https://anna.partners/anna-apps/carthavate/ai-engineering-arena/0.1.0/auth-callback.html";

  it("carries the one-time code", () => {
    expect(callbackMessage(`${base}?code=abc123`)).toEqual({ type: "arena-auth", code: "abc123" });
  });

  it("carries the error from the query or the hash", () => {
    expect(callbackMessage(`${base}?error=access_denied&error_description=User+cancelled`).error).toBe("User cancelled");
    expect(callbackMessage(`${base}#error=server_error&error_description=Bad%20state`).error).toBe("Bad state");
    expect(callbackMessage(base).error).toMatch(/didn't send a sign-in code/);
  });

  it("recognises only the Arena's messages", () => {
    expect(isAuthMessage({ type: "arena-auth", code: "x" })).toBe(true);
    expect(isAuthMessage({ type: "arena-auth" })).toBe(false);
    expect(isAuthMessage({ type: "other", code: "x" })).toBe(false);
    expect(isAuthMessage("arena-auth")).toBe(false);
  });
});
