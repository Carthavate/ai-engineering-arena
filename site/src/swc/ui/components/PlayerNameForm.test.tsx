// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fail, ok, type Outcome } from "../../logic/types";
import { PlayerNameForm } from "./PlayerNameForm";

afterEach(cleanup);

const type = (value: string) => fireEvent.change(screen.getByLabelText("Player name"), { target: { value } });
const save = () => act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });

describe("PlayerNameForm", () => {
  it("checks the name before sending it", async () => {
    const claim = vi.fn(async (name: string) => ok(name));
    render(<PlayerNameForm takenGithub="" claim={claim} />);
    type("no spaces");
    await save();
    expect(claim).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/3 to 39 letters/);
  });

  it("sends a valid name (without a leading @) and shows the database's refusal", async () => {
    const claim = vi.fn(async () => fail<string>("That player name is taken"));
    render(<PlayerNameForm takenGithub="" claim={claim} />);
    type(" @Skywalker ");
    await save();
    expect(claim).toHaveBeenCalledWith("Skywalker");
    expect(screen.getByRole("alert").textContent).toBe("That player name is taken");
  });

  it("saves a valid name, waiting for the answer before allowing another try", async () => {
    let answer: (res: Outcome<string>) => void = () => undefined;
    const claim = vi.fn(() => new Promise<Outcome<string>>((resolve) => { answer = resolve; }));
    render(<PlayerNameForm takenGithub="" claim={claim} />);
    type("rag-wizard");
    await save();
    expect(claim).toHaveBeenCalledWith("rag-wizard");
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveProperty("disabled", true);
    await act(async () => answer(ok("rag-wizard")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Player name").getAttribute("aria-invalid")).toBeNull();
  });

  it("explains why a GitHub player has to pick a name", () => {
    render(<PlayerNameForm takenGithub="carol" claim={async () => ok("x")} />);
    expect(screen.getByText(/already called carol/)).toBeTruthy();
  });
});
