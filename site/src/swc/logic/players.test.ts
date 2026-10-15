import { describe, expect, it } from "vitest";
import { cleanGithubInput, isGithubUsername } from "./players";

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
