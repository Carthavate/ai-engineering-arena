// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PlayersAdmin } from "../../../rte/usePlayers";
import { fail, ok, type Outcome } from "../../logic/types";
import type { LabData } from "../labData";
import { PlayersPanel } from "./PlayersPanel";

afterEach(cleanup);

const members = [
  { id: "a", handle: "boss", github_username: "boss", display_name: "Boss", avatar_url: null, is_member: true, is_admin: true },
  { id: "p", handle: "old-friend", github_username: "old-friend", display_name: "Old Friend", avatar_url: null, is_member: true },
  { id: "g", handle: "Skywalker", github_username: "", display_name: null, avatar_url: null, is_member: true },
];
const data = { me: members[0], members, now: new Date(), colorOf: () => "red" } as unknown as LabData;

const waiting = [
  { handle: "newbie", github_username: "newbie", provider: "github", account_name: null, display_name: null, avatar_url: null, signed_in_at: new Date().toISOString() },
  { handle: "Leia", github_username: "", provider: "google", account_name: "Leia Organa", display_name: null, avatar_url: null, signed_in_at: new Date().toISOString() },
];

/** An admin port whose delete answers only when the test says so; other actions are recorded. */
function fakeAdmin() {
  let answer: (res: Outcome<null>) => void = () => undefined;
  const calls: string[] = [];
  const record = (what: string) => async (name: string) => { calls.push(`${what} ${name}`); return ok(null); };
  const admin: PlayersAdmin = {
    overview: { waiting, declined: [], invited: ["future-friend"] },
    error: null,
    refresh: async () => undefined,
    invite: async () => ok({ signedIn: true }),
    cancelInvite: record("cancel"),
    letIn: record("let in"),
    remove: record("remove"),
    decline: record("decline"),
    delete: () => new Promise((resolve) => { answer = resolve; }),
  };
  return { admin, calls, answer: (res: Outcome<null>) => act(async () => answer(res)) };
}

function openAndType(github: string) {
  fireEvent.click(screen.getByRole("button", { name: `Delete @${github} for good` }));
  fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: github } });
  fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
}

describe("PlayersPanel delete", () => {
  it("disables every other action while deleting, and keeps the form open with the error on failure", async () => {
    const { admin, answer } = fakeAdmin();
    render(<PlayersPanel data={data} admin={admin} />);
    openAndType("old-friend");

    expect(screen.getByRole("button", { name: "Deleting…" })).toHaveProperty("disabled", true);
    for (const b of screen.getAllByRole("button", { name: "Let in" })) expect(b).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Delete @newbie for good" })).toHaveProperty("disabled", true);

    await answer(fail("Couldn't delete that player."));
    expect(screen.getByRole("alert").textContent).toBe("Couldn't delete that player.");
    expect(screen.getByLabelText(/to confirm/)).toHaveProperty("value", "old-friend");
    for (const b of screen.getAllByRole("button", { name: "Let in" })) expect(b).toHaveProperty("disabled", false);
  });

  it("closes the form and says so after a delete", async () => {
    const { admin, answer } = fakeAdmin();
    render(<PlayersPanel data={data} admin={admin} />);
    openAndType("old-friend");
    await answer(ok(null));
    expect(screen.queryByLabelText(/to confirm/)).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("@old-friend is deleted");
  });

  it("never offers to delete an admin", () => {
    render(<PlayersPanel data={data} admin={fakeAdmin().admin} />);
    expect(screen.queryByRole("button", { name: "Delete @boss for good" })).toBeNull();
  });
});

describe("PlayersPanel names", () => {
  it("shows which account a waiting player used, and acts on them by player name", async () => {
    const { admin, calls } = fakeAdmin();
    render(<PlayersPanel data={data} admin={admin} />);
    expect(screen.getByText(/@Leia · Google: Leia Organa/)).toBeTruthy();
    expect(screen.getByText(/@newbie · GitHub ·/)).toBeTruthy();

    const leia = screen.getByText(/@Leia ·/).closest("li") as HTMLElement;
    await act(async () => { fireEvent.click(within(leia).getByRole("button", { name: "Let in" })); });
    expect(calls).toEqual(["let in Leia"]);
    expect(screen.getByRole("status").textContent).toBe("Leia is now a player.");
  });

  it("lists Google players by player name, and cancels an invite instead of removing anyone", async () => {
    const { admin, calls } = fakeAdmin();
    render(<PlayersPanel data={data} admin={admin} />);
    expect(screen.getByText("@Skywalker · Google")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel the invite for future-friend" })); });
    expect(calls).toEqual(["cancel future-friend"]);
  });
});
