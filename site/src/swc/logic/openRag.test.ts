import { describe, expect, it } from "vitest";
import { downloadUrl, OPEN_RAG_FILES, openRagReward } from "./openRag";
import { PHASES } from "./roadmap";

const rag = PHASES.find((p) => p.id === "rag")!;
const ticked = (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, "2026-11-02T10:00:00Z"]));

describe("openRagReward", () => {
  it("stays locked, with the count so far, until every lesson is ticked", () => {
    const done = ticked(rag.items.slice(0, 12).map((i) => i.id));
    expect(openRagReward(rag, done)).toEqual({ unlocked: false, done: 12, total: 17 });
  });

  it("unlocks when the whole RAG course is done", () => {
    expect(openRagReward(rag, ticked(rag.items.map((i) => i.id)))).toEqual({ unlocked: true, done: 17, total: 17 });
  });

  it("ignores items from other phases", () => {
    expect(openRagReward(rag, ticked(["p0-1", "p0-2"]))?.done).toBe(0);
  });

  it("belongs to the RAG course only", () => {
    expect(openRagReward(PHASES.find((p) => p.id !== "rag")!, {})).toBeNull();
  });
});

describe("downloads", () => {
  it("point at the latest release, setup first", () => {
    expect(OPEN_RAG_FILES[0]).toBe("OpenRag-Setup.exe");
    expect(downloadUrl("OpenRag-Setup.exe")).toBe(
      "https://github.com/Carthavate/open-rag-engine/releases/latest/download/OpenRag-Setup.exe",
    );
  });
});
