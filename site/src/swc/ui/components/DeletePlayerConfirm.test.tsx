// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeletePlayerConfirm } from "./DeletePlayerConfirm";

afterEach(cleanup);

const props = { busy: false, pending: false, error: null, onConfirm: () => undefined, onCancel: () => undefined };

describe("DeletePlayerConfirm", () => {
  it("deletes only once the admin types the username (any case, extra spaces ok)", () => {
    const onConfirm = vi.fn();
    render(<DeletePlayerConfirm {...props} github="old-friend" onConfirm={onConfirm} />);
    const button = screen.getByRole("button", { name: "Delete forever" });
    const input = screen.getByLabelText(/to confirm/);
    expect(button).toHaveProperty("disabled", true);
    expect(input.getAttribute("aria-describedby")).toBeTruthy();

    fireEvent.change(input, { target: { value: "old-frien" } });
    fireEvent.submit(button.closest("form")!);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: " OLD-FRIEND " } });
    expect(button).toHaveProperty("disabled", false);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels with the button or Escape, and can't be sent while an action runs", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<DeletePlayerConfirm {...props} github="test-player" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByLabelText(/to confirm/), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);

    rerender(<DeletePlayerConfirm {...props} github="test-player" busy pending onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "test-player" } });
    const button = screen.getByRole("button", { name: "Deleting…" });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.submit(button.closest("form")!);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows why the last try failed", () => {
    render(<DeletePlayerConfirm {...props} github="test-player" error="Admins can't be deleted" />);
    expect(screen.getByRole("alert").textContent).toBe("Admins can't be deleted");
  });

  it("never unlocks for a profile without a username", () => {
    render(<DeletePlayerConfirm {...props} github="" />);
    expect(screen.getByRole("button", { name: "Delete forever" })).toHaveProperty("disabled", true);
  });
});
