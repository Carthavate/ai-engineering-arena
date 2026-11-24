// What the sign-in popup sends back to the Arena window in Anna. Kept free of Supabase so the popup page stays tiny.

/**
 * Where the Anna app's sign-in popup returns: a page on the website. Anna won't serve an app's own files to a
 * popup (it redirects them to its login page), so the popup can't come back to anna.partners.
 */
export const CALLBACK_URL: string =
  (import.meta.env.VITE_ANNA_CALLBACK_URL as string | undefined) ?? "https://carthavate.github.io/ai-engineering-arena/anna-callback.html";

/** The only origin the popup hands its code to. */
export const ANNA_ORIGIN = "https://anna.partners";

export interface AuthMessage {
  readonly type: "arena-auth";
  /** One-time PKCE code: useless without the verifier, which never leaves the app window's memory. */
  readonly code?: string;
  readonly error?: string;
}

export function isAuthMessage(data: unknown): data is AuthMessage {
  if (typeof data !== "object" || data === null) return false;
  const m = data as Record<string, unknown>;
  return m.type === "arena-auth" && (typeof m.code === "string" || typeof m.error === "string");
}

/** Read the outcome from the URL Supabase redirected the popup to (?code=… or an error in the query or hash). */
export function callbackMessage(href: string): AuthMessage {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const code = url.searchParams.get("code");
  if (code) return { type: "arena-auth", code };
  const error =
    url.searchParams.get("error_description") ?? hash.get("error_description") ?? url.searchParams.get("error") ?? hash.get("error");
  return { type: "arena-auth", error: error ?? "The sign-in page didn't send a sign-in code." };
}
