// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "../../../rte/useAuth";
import { ok } from "../../logic/types";
import { TopBar } from "./TopBar";

afterEach(cleanup);

function signedOut(): AuthState {
  return {
    session: null, profile: null, loading: false, error: null,
    signIn: vi.fn(async () => undefined), signOut: vi.fn(async () => undefined), claimHandle: async (name) => ok(name),
  };
}

describe("TopBar sign-in", () => {
  it("offers GitHub and Google, each starting its own sign-in", () => {
    const auth = signedOut();
    render(<TopBar page="dashboard" auth={auth} enabled myStats={undefined} myColor="red" invites={0} onBell={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in with GitHub" }));
    expect(auth.signIn).toHaveBeenNthCalledWith(1, "google");
    expect(auth.signIn).toHaveBeenNthCalledWith(2, "github");
  });

  it("shows no sign-in when the site has no database", () => {
    render(<TopBar page="dashboard" auth={signedOut()} enabled={false} myStats={undefined} myColor="red" invites={0} onBell={() => undefined} />);
    expect(screen.queryByRole("group", { name: "Sign in" })).toBeNull();
  });
});
