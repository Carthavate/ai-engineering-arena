import { describe, expect, it } from "vitest";
import { href, nextView, parseRoute } from "./route";

describe("parseRoute", () => {
  it("defaults to the dashboard", () => {
    expect(parseRoute("")).toEqual({ page: "dashboard" });
    expect(parseRoute("#/")).toEqual({ page: "dashboard" });
    expect(parseRoute("#/nonsense")).toEqual({ page: "dashboard" });
  });

  it("reads pages and phases", () => {
    expect(parseRoute("#/activity")).toEqual({ page: "activity" });
    expect(parseRoute("#/roadmap")).toEqual({ page: "roadmap", phase: undefined });
    expect(parseRoute("#/roadmap/p3")).toEqual({ page: "roadmap", phase: "p3" });
    expect(parseRoute("#/roadmap/zzz")).toEqual({ page: "roadmap", phase: undefined });
  });

  it("reads player pages and rejects bad names", () => {
    expect(parseRoute("#/player/TWadi")).toEqual({ page: "player", player: "TWadi" });
    expect(parseRoute("#/player/bad%20name")).toEqual({ page: "dashboard" });
    expect(parseRoute("#/player/")).toEqual({ page: "dashboard" });
    expect(href({ page: "player", player: "octo-cat" })).toBe("#/player/octo-cat");
  });

  it("reads lab pages", () => {
    expect(parseRoute("#/lab")).toEqual({ page: "lab" });
    expect(parseRoute("#/lab/cosine-similarity")).toEqual({ page: "lab", lab: "cosine-similarity" });
    expect(parseRoute("#/lab/playground")).toEqual({ page: "lab", lab: "playground" });
    expect(href({ page: "lab", lab: "rrf" })).toBe("#/lab/rrf");
  });

  it("keeps old phase links working", () => {
    expect(parseRoute("#rag")).toEqual({ page: "roadmap", phase: "rag" });
    expect(parseRoute("#p4")).toEqual({ page: "roadmap", phase: "p4" });
  });

  it("reads lesson links and rejects unknown lessons", () => {
    expect(parseRoute("#/lesson/rag-12")).toEqual({ page: "lesson", lesson: "rag-12" });
    expect(parseRoute("#/lesson/p4-8")).toEqual({ page: "lesson", lesson: "p4-8" });
    expect(parseRoute("#/lesson/nope")).toEqual({ page: "dashboard" });
    expect(parseRoute("#/lesson/")).toEqual({ page: "dashboard" });
    expect(href({ page: "lesson", lesson: "rag-12" })).toBe("#/lesson/rag-12");
  });

  it("round-trips through href", () => {
    const routes = [
      { page: "dashboard" as const }, { page: "activity" as const }, { page: "roadmap" as const, phase: "p2" },
      { page: "lesson" as const, lesson: "rag-3" },
    ];
    for (const r of routes) expect(parseRoute(href(r))).toMatchObject(r);
  });
});

describe("nextView", () => {
  it("shows plain pages without a panel", () => {
    expect(nextView(null, { page: "activity" })).toEqual({ page: { page: "activity" }, lesson: null });
  });

  it("opens a lesson over the page that was showing", () => {
    const dash = nextView(null, { page: "dashboard" });
    const open = nextView(dash, { page: "lesson", lesson: "p1-3" });
    expect(open).toEqual({ page: { page: "dashboard" }, lesson: "p1-3" });
    // Moving to the next lesson keeps the same page behind the panel.
    expect(nextView(open, { page: "lesson", lesson: "p1-4" })).toEqual({ page: { page: "dashboard" }, lesson: "p1-4" });
    // Back: the page again, panel closed.
    expect(nextView(open, { page: "dashboard" })).toEqual({ page: { page: "dashboard" }, lesson: null });
  });

  it("puts the lesson's phase behind a fresh deep link", () => {
    expect(nextView(null, parseRoute("#/lesson/rag-12"))).toEqual({ page: { page: "roadmap", phase: "rag" }, lesson: "rag-12" });
  });
});
