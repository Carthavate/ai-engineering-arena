/** Valid GitHub username: letters, digits and single hyphens, no leading/trailing hyphen, max 39. */
export function isGithubUsername(name: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(name);
}

/** Accepts "octocat", "@octocat" or a github.com/octocat link. */
export function cleanGithubInput(raw: string): string {
  return raw.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/.*$/, "");
}
