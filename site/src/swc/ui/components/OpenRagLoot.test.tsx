// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { downloadUrl, OPEN_RAG_FILES } from "../../logic/openRag";
import { OpenRagLoot } from "./OpenRagLoot";

afterEach(cleanup);

describe("OpenRagLoot", () => {
  it("shows the count and no downloads while locked", () => {
    render(<OpenRagLoot reward={{ unlocked: false, done: 12, total: 17 }} />);
    expect(screen.getByRole("heading", { name: "Clear all 17 lessons to unlock Open RAG" })).toBeTruthy();
    expect(screen.getByText("12/17")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /OpenRag-Setup/ })).toBeNull();
  });

  it("offers every part of the installer once unlocked", () => {
    render(<OpenRagLoot reward={{ unlocked: true, done: 17, total: 17 }} />);
    expect(screen.getByRole("heading", { name: "Open RAG is yours" })).toBeTruthy();
    const links = screen.getAllByRole("link", { name: /OpenRag-Setup/ });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(OPEN_RAG_FILES.map(downloadUrl));
  });
});
