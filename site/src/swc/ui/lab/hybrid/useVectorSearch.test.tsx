// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { HYBRID_DOCS } from "../../../logic/lab/hybrid";
import type { Rte } from "../../../../rte/ports";
import { RteProvider } from "../../../../rte/RteContext";
import { useVectorSearch } from "./useVectorSearch";

afterEach(cleanup);

/** An embedder whose single-text calls wait until the test releases them, so answers can arrive in any order. */
function controlledEmbedder() {
  const waiting = new Map<string, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>();
  const embedder = {
    embed: (texts: readonly string[]) => {
      if (texts.length > 1) return Promise.resolve(texts.map((_, i) => [i === 0 ? 1 : 0, i === 0 ? 0 : 1]));
      return new Promise<number[][]>((resolve, reject) => waiting.set(texts[0], { resolve, reject }));
    },
  };
  const answer = (q: string) => act(async () => waiting.get(q)!.resolve([[1, 0]]));
  const fail = (q: string) => act(async () => waiting.get(q)!.reject(new Error("offline")));
  const asked = (q: string) => waiting.has(q);
  return { embedder, answer, fail, asked };
}

function setup() {
  const fake = controlledEmbedder();
  const wrapper = ({ children }: { children: ReactNode }) => <RteProvider rte={{ embedder: fake.embedder } as unknown as Rte}>{children}</RteProvider>;
  const hook = renderHook(({ q }) => useVectorSearch(q), { wrapper, initialProps: { q: "first" } });
  return { ...fake, hook };
}

describe("useVectorSearch", () => {
  it("asks for the documents first", () => {
    expect(setup().hook.result.current.status).toBe("needs-docs");
  });

  it("shows the newest query's ranking even when an older answer arrives last", async () => {
    const { hook, answer, asked } = setup();
    act(() => hook.result.current.embedDocuments());
    await waitFor(() => expect(asked("first")).toBe(true));
    hook.rerender({ q: "second" });
    await waitFor(() => expect(asked("second")).toBe(true));
    await answer("second");
    await answer("first");
    expect(hook.result.current.status).toBe("ready");
    expect(hook.result.current.ranked).toHaveLength(Math.min(5, HYBRID_DOCS.length));
  });

  it("embeds a query picked while the documents were still embedding", async () => {
    const { hook, answer, asked } = setup();
    act(() => hook.result.current.embedDocuments());
    hook.rerender({ q: "second" });
    await waitFor(() => expect(asked("second")).toBe(true));
    await answer("second");
    expect(hook.result.current.status).toBe("ready");
  });

  it("reports a failed query and embeds it again on retry", async () => {
    const { hook, fail, answer, asked } = setup();
    act(() => hook.result.current.embedDocuments());
    await waitFor(() => expect(asked("first")).toBe(true));
    await fail("first");
    expect(hook.result.current.status).toBe("failed");
    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.status).toBe("embedding"));
    await answer("first");
    expect(hook.result.current.status).toBe("ready");
  });
});
