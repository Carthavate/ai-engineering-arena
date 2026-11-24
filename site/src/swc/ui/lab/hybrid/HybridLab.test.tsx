// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Rte } from "../../../../rte/ports";
import { RteProvider } from "../../../../rte/RteContext";
import { HybridLab } from "./HybridLab";

afterEach(cleanup);

/** Meaning stand-in: each text points at the first topic word it contains. */
const TOPICS: readonly RegExp[] = [/refund|money|return/i, /rain|wet|IPX5/i, /freez|cold|winter/i, /brake|BP-4471/i];
const fakeEmbedder = {
  info: { label: "a test embedder", detail: "Runs a test embedder." },
  embed: async (texts: readonly string[]) => texts.map((t) => {
    const hit = TOPICS.findIndex((re) => re.test(t));
    return TOPICS.map((_, i) => (i === hit ? 1 : 0.01));
  }),
};

function renderLab() {
  return render(<RteProvider rte={{ embedder: fakeEmbedder } as unknown as Rte}><HybridLab /></RteProvider>);
}

const column = (title: string) => screen.getByRole("heading", { name: title }).parentElement!;
const chips = (el: HTMLElement) => [...el.querySelectorAll(".hy-chip")].map((c) => c.textContent);

describe("HybridLab", () => {
  it("scores the part number with BM25 and explains the score term by term", () => {
    renderLab();
    expect(chips(column("BM25 (keywords)"))).toEqual(["Brake pads"]);
    const table = screen.getByRole("table");
    expect(within(table).getByText("bp")).toBeTruthy();
    expect(within(table).getByText("4471")).toBeTruthy();
  });

  it("shows BM25 finding nothing for a paraphrase", () => {
    renderLab();
    fireEvent.click(screen.getByRole("button", { name: "Can I get my money back?" }));
    expect(screen.getAllByText(/BM25 returns nothing/).length).toBe(1);
  });

  it("fuses the BM25 and vector lists once the documents are embedded", async () => {
    renderLab();
    fireEvent.click(screen.getByRole("button", { name: "Can I get my money back?" }));
    fireEvent.click(screen.getByRole("button", { name: "Embed the documents" }));
    await waitFor(() => expect(chips(column("Vector (meaning)"))[0]).toBe("Returns"));
    expect(chips(column("Fused (RRF)"))[0]).toBe("Returns");
  });

  it("re-ranks with the vector side only when BM25's weight is 0", async () => {
    renderLab();
    fireEvent.click(screen.getByRole("button", { name: "Is it ok to ride the e-bike when it's wet?" }));
    fireEvent.click(screen.getByRole("button", { name: "Embed the documents" }));
    await waitFor(() => expect(chips(column("Vector (meaning)"))[0]).toBe("E2 in the rain"));
    expect(chips(column("Fused (RRF)"))[0]).not.toBe("E2 in the rain");
    fireEvent.change(screen.getByRole("slider", { name: /Weight/ }), { target: { value: "0" } });
    expect(chips(column("Fused (RRF)"))[0]).toBe("E2 in the rain");
  });
});
