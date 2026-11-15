// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PHASES } from "../../logic/roadmap";
import type { LabData } from "../labData";
import { LessonLab } from "./LessonLab";

afterEach(cleanup);

const item = (id: string) => PHASES.flatMap((p) => p.items).find((i) => i.id === id)!;
/** Only the fields LessonLab reads. */
const data = (solved: readonly string[]) =>
  ({ me: { id: "u1" }, solves: solved.map((challenge_id) => ({ user_id: "u1", challenge_id })) }) as unknown as LabData;

describe("LessonLab", () => {
  it("links lesson #1 to the How RAG works explorer", () => {
    render(<LessonLab item={item("rag-1")} data={data([])} />);
    expect(screen.getByRole("link", { name: /How RAG works/ }).getAttribute("href")).toBe("#/lab/how-rag-works");
  });

  it("links a lesson's challenge and marks it solved for the player", () => {
    render(<LessonLab item={item("rag-3")} data={data(["chunk-overlap"])} />);
    const link = screen.getByRole("link", { name: /Chunk text with overlap/ });
    expect(link.getAttribute("href")).toBe("#/lab/chunk-overlap");
    expect(link.textContent).toContain("Solved");
  });

  it("renders nothing for a lesson without Lab pages", () => {
    const { container } = render(<LessonLab item={item("rag-7")} data={data([])} />);
    expect(container.innerHTML).toBe("");
  });
});
