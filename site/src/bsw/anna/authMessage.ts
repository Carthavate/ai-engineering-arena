// What the sign-in popup sends back to the Arena window. Kept free of Supabase so the popup page stays tiny.

/** BroadcastChannel name; the popup and the app window share Anna's origin. */
export const AUTH_CHANNEL = "arena-anna-auth";

/** The page GitHub sign-in returns to, next to the app's index.html in the bundle. */
export const CALLBACK_PAGE = "auth-callback.html";

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
  return { type: "arena-auth", error: error ?? "GitHub didn't send a sign-in code." };
}
