import type { WaitingPlayer } from "./types";

/** Valid GitHub username: letters, digits and single hyphens, no leading/trailing hyphen, max 39. */
export function isGithubUsername(name: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(name);
}

/** Accepts "octocat", "@octocat" or a github.com/octocat link. */
export function cleanGithubInput(raw: string): string {
  return raw.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/.*$/, "");
}

/** A player name someone picks: like a GitHub username, but at least 3 characters (the database checks it too). */
export function isPlayerName(name: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){2,38}$/.test(name);
}

/** How a player is labelled: their public name if they have one, else their player name. */
export function playerLabel(p: { readonly display_name: string | null; readonly handle: string }): string {
  return p.display_name || p.handle;
}

/** For admins deciding who to let in: which account someone signed in with. */
export function accountLabel(w: WaitingPlayer): string {
  if (w.provider === "github") return w.github_username.toLowerCase() === w.handle.toLowerCase() ? "GitHub" : `GitHub @${w.github_username}`;
  const provider = w.provider === "google" ? "Google" : w.provider || "Unknown sign-in";
  return w.account_name ? `${provider}: ${w.account_name}` : provider;
}
