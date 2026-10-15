// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PlayersAdmin } from "../../../rte/usePlayers";
import { fail, ok, type Outcome } from "../../logic/types";
import type { LabData } from "../labData";
import { PlayersPanel } from "./PlayersPanel";

afterEach(cleanup);

const members = [
  { id: "a", github_username: "boss", display_name: "Boss", avatar_url: null, is_member: true, is_admin: true },
  { id: "p", github_username: "old-friend", display_name: "Old Friend", avatar_url: null, is_member: true },
];
const data = { me: members[0], members, now: new Date(), colorOf: () => "red" } as unknown as LabData;

/** An admin port whose delete answers only when the test says so. */
function fakeAdmin() {
  let answer: (res: Outcome<null>) => void = () => undefined;
  const admin: PlayersAdmin = {
    overview: { waiting: [{ github_username: "newbie", display_name: null, avatar_url: null, signed_in_at: new Date().toISOString() }], declined: [], invited: [] },
    error: null,
    refresh: async () => undefined,
    invite: async () => ok({ signedIn: true }),
    remove: async () => ok(null),
    decline: async () => ok(null),
    delete: () => new Promise((resolve) => { answer = resolve; }),
  };
  return { admin, answer: (res: Outcome<null>) => act(async () => answer(res)) };
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
    expect(screen.getByRole("button", { name: "Let in" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Delete @newbie for good" })).toHaveProperty("disabled", true);

    await answer(fail("Couldn't delete that player."));
    expect(screen.getByRole("alert").textContent).toBe("Couldn't delete that player.");
    expect(screen.getByLabelText(/to confirm/)).toHaveProperty("value", "old-friend");
    expect(screen.getByRole("button", { name: "Let in" })).toHaveProperty("disabled", false);
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
