import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthPort } from "../../rte/ports";
import { supabaseAuth } from "../supabase/auth";
import { CALLBACK_URL, isAuthMessage, type AuthMessage } from "./authMessage";
import type { AnnaHost } from "./host";

/** The refresh token, in the app's private Anna storage, keeps the player signed in between Anna windows. */
export const SESSION_KEY = "auth/refresh-token";

const POPUP_FEATURES = "popup,width=520,height=720";
const SIGN_IN_TIMEOUT_MS = 5 * 60_000;
/** The popup posts its message and closes itself: give the message a moment to arrive before calling it abandoned. */
const CLOSED_GRACE_MS = 3000;

/** Waits for the message the website's callback page posts back through window.opener. */
function waitForCallback(popup: Window): Promise<AuthMessage> {
  const callbackOrigin = new URL(CALLBACK_URL).origin;
  return new Promise((resolve, reject) => {
    let closedTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (settle: () => void) => {
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
      clearTimeout(timeout);
      clearTimeout(closedTimer);
      settle();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin === callbackOrigin && isAuthMessage(e.data)) finish(() => resolve(e.data));
    };
    window.addEventListener("message", onMessage);
    const poll = setInterval(() => {
      if (popup.closed && closedTimer === undefined) {
        closedTimer = setTimeout(() => finish(() => reject(new Error("The sign-in window was closed before you finished."))), CLOSED_GRACE_MS);
      }
    }, 500);
    const timeout = setTimeout(() => finish(() => reject(new Error("Sign-in timed out. Try again."))), SIGN_IN_TIMEOUT_MS);
  });
}

/**
 * Open the sign-in popup right away, inside the click, so the browser doesn't block it; it gets its address once
 * Supabase has made the PKCE challenge.
 */
export function openSignInPopup(): Window {
  const popup = window.open("about:blank", "arena-sign-in", POPUP_FEATURES);
  if (!popup) throw new Error("Your browser blocked the sign-in window. Allow popups for anna.partners and try again.");
  return popup;
}

/**
 * GitHub sign-in in a popup: Anna's page can't be redirected away, and it won't serve the app's files to a popup,
 * so the popup returns to a page on the website that posts the one-time code back here.
 */
export async function signInWithPopup(client: SupabaseClient, popup: Window): Promise<void> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: CALLBACK_URL, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    popup.close();
    throw new Error("GitHub sign-in couldn't start.");
  }
  popup.location.href = data.url;
  const result = await waitForCallback(popup);
  if (!result.code) throw new Error(`GitHub sign-in failed: ${result.error}`);
  const { error: exchangeError } = await client.auth.exchangeCodeForSession(result.code);
  if (exchangeError) throw new Error("GitHub sign-in failed: the sign-in code was refused.");
}

/** Sign back in with the refresh token saved by an earlier window, if there is one that still works. */
export async function restoreSession(client: SupabaseClient, host: AnnaHost): Promise<void> {
  const saved = await host.storage.get({ key: SESSION_KEY }).catch(() => null);
  if (!saved?.exists || typeof saved.value !== "string") return;
  const { error } = await client.auth.refreshSession({ refresh_token: saved.value });
  if (error) await host.storage.delete({ key: SESSION_KEY }).catch(() => undefined);
}

/** Save each new refresh token (Supabase rotates them) and forget it on sign-out. */
export function keepSession(client: SupabaseClient, host: AnnaHost): () => void {
  const { data } = client.auth.onAuthStateChange((event, session) => {
    // Defer: Supabase recommends not calling other APIs inside this callback.
    setTimeout(() => {
      const write = session?.refresh_token
        ? host.storage.set({ key: SESSION_KEY, value: session.refresh_token })
        : event === "SIGNED_OUT" ? host.storage.delete({ key: SESSION_KEY }) : null;
      write?.catch((e: unknown) => console.error("Couldn't save the sign-in in Anna", e));
    }, 0);
  });
  return () => data.subscription.unsubscribe();
}

/** Supabase Auth as on the website, except that sign-in happens in a popup. */
export function annaAuth(client: SupabaseClient): AuthPort {
  return {
    ...supabaseAuth(client),
    async signIn() {
      try {
        // No await before this: the popup must open inside the click.
        await signInWithPopup(client, openSignInPopup());
      } catch (e) {
        console.error(e);
        window.alert(e instanceof Error ? e.message : "GitHub sign-in failed.");
      }
    },
  };
}
