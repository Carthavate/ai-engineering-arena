// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HowRagWorks } from "./HowRagWorks";

afterEach(cleanup);

const part = (name: RegExp) => screen.getByRole("button", { name });
const inspector = () => screen.getByRole("region", { name: "Inspector" });

describe("HowRagWorks", () => {
  it("starts with the one-line explanation and every part listed", () => {
    render(<HowRagWorks />);
    expect(inspector().textContent).toContain("Look it up first, then answer.");
    expect(inspector().querySelectorAll(".play-parts button")).toHaveLength(8);
  });

  it("inspects a focused part below the drawing and keeps it after focus leaves", () => {
    render(<HowRagWorks />);
    act(() => part(/^Vector database:/).focus());
    expect(inspector().textContent).toContain("What it does");
    expect(inspector().textContent).toContain("You can return any Orbit bike");
    act(() => part(/^Vector database:/).blur());
    expect(inspector().textContent).toContain("Vector database");
  });

  it("closes the inspector with Escape or its Close button", () => {
    render(<HowRagWorks />);
    fireEvent.click(part(/^LLM:/));
    expect(inspector().textContent).toContain("knowledge cutoff");
    fireEvent.keyDown(part(/^LLM:/), { key: "Escape" });
    expect(inspector().textContent).toContain("Look it up first");
    fireEvent.click(part(/^LLM:/));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(inspector().textContent).toContain("Look it up first");
  });

  it("follows the Try it question and retrieval switch", () => {
    render(<HowRagWorks />);
    fireEvent.click(screen.getByRole("tab", { name: "Try it" }));
    fireEvent.click(screen.getByRole("button", { name: "How long is the frame warranty?" }));
    fireEvent.click(part(/^Answer:/));
    expect(inspector().textContent).toContain("5-year warranty");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(inspector().textContent).toContain("1-year warranty");
  });

  it("keeps a Try it run when the walkthrough is opened", () => {
    render(<HowRagWorks />);
    fireEvent.click(screen.getByRole("tab", { name: "Try it" }));
    fireEvent.click(screen.getByRole("button", { name: "Can I ride the E2 in the rain?" }));
    fireEvent.click(screen.getByRole("tab", { name: "Walkthrough" }));
    fireEvent.click(screen.getByRole("tab", { name: "Try it" }));
    expect(screen.getByRole("tabpanel", { name: "Try it" }).textContent).toContain("IPX5");
  });

  it("turns retrieval off in Try it when the walkthrough shows the no-RAG path", () => {
    render(<HowRagWorks />);
    fireEvent.click(screen.getByRole("button", { name: "Without RAG" }));
    expect((screen.getByRole("checkbox", { hidden: true }) as HTMLInputElement).checked).toBe(false);
  });

  it("draws only the current step's wires as lit", () => {
    const { container } = render(<HowRagWorks />);
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(container.querySelectorAll(".wire-lit")).toHaveLength(1);
  });
});
