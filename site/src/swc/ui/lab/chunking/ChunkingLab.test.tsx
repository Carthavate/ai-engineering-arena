// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Rte } from "../../../../rte/ports";
import { RteProvider } from "../../../../rte/RteContext";
import { ChunkingLab } from "./ChunkingLab";

afterEach(cleanup);

/** One topic per paragraph of the sample; a sentence without a topic word stays on the previous topic. */
const TOPICS: readonly RegExp[] = [/return|refund/i, /warranty/i, /E2|battery|charge/i, /deliver|assembled/i];
const fakeEmbedder = {
  info: { label: "a test embedder", detail: "Runs a test embedder." },
  embed: async (texts: readonly string[]) => {
    let topic = 0;
    return texts.map((t) => {
      const hit = TOPICS.findIndex((re) => re.test(t));
      topic = hit >= 0 ? hit : topic;
      return TOPICS.map((_, i) => (i === topic ? 1 : 0));
    });
  },
};

function renderLab() {
  return render(<RteProvider rte={{ embedder: fakeEmbedder } as unknown as Rte}><ChunkingLab /></RteProvider>);
}

const verdict = () => document.querySelector(".ck-verdict")?.textContent ?? "";
const stats = () => document.querySelector(".ck-stats")?.textContent ?? "";

describe("ChunkingLab", () => {
  it("opens on fixed-size chunks that cut the battery answer in two", () => {
    renderLab();
    expect(verdict()).toContain("No chunk holds the whole answer");
    expect(stats()).toMatch(/[1-9]\d* of \d+ cuts break a sentence/);
    expect(document.querySelectorAll(".ck-cut-broken").length).toBeGreaterThan(0);
  });

  it("keeps sentences whole with the recursive splitter", () => {
    renderLab();
    fireEvent.click(screen.getByRole("button", { name: "Recursive" }));
    expect(verdict()).toContain("holds the whole answer");
    expect(stats()).toContain("0 of");
    expect(stats()).toContain("split at: paragraph → sentence");
  });

  it("cuts by topic after embedding the sentences", async () => {
    renderLab();
    fireEvent.click(screen.getByRole("button", { name: "Semantic" }));
    expect(document.querySelector(".ck-doc")?.querySelectorAll(".ck-cut").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Embed the sentences" }));
    await waitFor(() => expect(document.querySelector(".bp-chart")).not.toBeNull());
    expect(stats()).toMatch(/^4 chunks/);
  });

  it("steps through chunks in the inspector", () => {
    renderLab();
    const heading = () => screen.getByRole("heading", { name: /^Chunk \d/ }).textContent;
    const before = heading();
    fireEvent.click(screen.getByRole("button", { name: "Next chunk" }));
    expect(heading()).not.toBe(before);
  });

  it("can't judge the answer once the text no longer contains it", () => {
    renderLab();
    fireEvent.click(screen.getByRole("button", { name: "Edit the text" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your text" }), { target: { value: "A different text. It has two sentences." } });
    fireEvent.click(screen.getByRole("button", { name: "Use this text" }));
    expect(verdict()).toContain("doesn't contain this answer");
  });
});
