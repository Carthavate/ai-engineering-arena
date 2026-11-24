import { describe, expect, it } from "vitest";
import { accountLabel, cleanGithubInput, isGithubUsername, isPlayerName, playerLabel } from "./players";
import type { WaitingPlayer } from "./types";

describe("GitHub usernames", () => {
  it("accepts real usernames", () => {
    for (const name of ["TWadi", "GhassenJamoussi99", "octo-cat", "a", "x".repeat(39)]) {
      expect(isGithubUsername(name)).toBe(true);
    }
  });

  it("rejects what GitHub rejects", () => {
    for (const name of ["", "-octocat", "octocat-", "octo--cat", "octo cat", "octo_cat", "x".repeat(40), "octo'cat"]) {
      expect(isGithubUsername(name)).toBe(false);
    }
  });

  it("cleans pasted handles and profile links", () => {
    expect(cleanGithubInput("  @octo-cat ")).toBe("octo-cat");
    expect(cleanGithubInput("https://github.com/octo-cat")).toBe("octo-cat");
    expect(cleanGithubInput("https://www.github.com/octo-cat/some-repo")).toBe("octo-cat");
    expect(cleanGithubInput("octocat")).toBe("octocat");
  });
});

describe("player names", () => {
  it("are GitHub-style names of 3 to 39 characters", () => {
    for (const name of ["Skywalker", "rag-wizard", "abc", "x".repeat(39)]) expect(isPlayerName(name)).toBe(true);
    for (const name of ["ab", "-sky", "sky-", "sky--walker", "sky walker", "sky_walker", "x".repeat(40), "<b>"]) {
      expect(isPlayerName(name)).toBe(false);
    }
  });

  it("label a player by their public name, else their player name", () => {
    expect(playerLabel({ display_name: "Jane", handle: "jane-gh" })).toBe("Jane");
    expect(playerLabel({ display_name: null, handle: "Skywalker" })).toBe("Skywalker");
  });

  it("tell admins which account someone signed in with", () => {
    const base: WaitingPlayer = { handle: "Skywalker", github_username: "", provider: "google", account_name: "Jane Doe", display_name: null, avatar_url: null, signed_in_at: "" };
    expect(accountLabel(base)).toBe("Google: Jane Doe");
    expect(accountLabel({ ...base, account_name: null })).toBe("Google");
    expect(accountLabel({ ...base, provider: "github", github_username: "skywalker" })).toBe("GitHub");
    expect(accountLabel({ ...base, provider: "github", github_username: "sky", handle: "sky-gh" })).toBe("GitHub @sky");
  });
});
