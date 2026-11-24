// @vitest-environment jsdom
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { annaAuth, keepSession, openSignInPopup, restoreSession, SESSION_KEY, signInWithPopup } from "./auth";
import type { AnnaHost } from "./host";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function memoryStorage(initial: Record<string, unknown> = {}): AnnaHost["storage"] & { readonly data: Map<string, unknown> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async ({ key }) => ({ value: data.get(key), exists: data.has(key) }),
    set: async ({ key, value }) => { data.set(key, value); return {}; },
    delete: async ({ key }) => { data.delete(key); return {}; },
    list: async () => ({ items: [], next_cursor: null }),
  };
}

const hostWith = (storage: AnnaHost["storage"]): AnnaHost => ({ llm: {} as AnnaHost["llm"], storage });

type AuthListener = (event: string, session: { refresh_token: string } | null) => void;

/** Only the Supabase Auth calls the Anna sign-in makes. */
function fakeClient(opts: { refreshError?: boolean } = {}) {
  let listener: AuthListener = () => undefined;
  const auth = {
    signInWithOAuth: vi.fn(async () => ({ data: { url: "https://supabase.example/authorize?provider=github" }, error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ error: null })),
    refreshSession: vi.fn(async () => ({ error: opts.refreshError ? new Error("expired") : null })),
    onAuthStateChange: vi.fn((cb: AuthListener) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
  };
  return { client: { auth } as unknown as SupabaseClient, auth, emit: (event: string, s: { refresh_token: string } | null) => listener(event, s) };
}

describe("restoreSession", () => {
  it("signs back in with the saved refresh token", async () => {
    const { client, auth } = fakeClient();
    await restoreSession(client, hostWith(memoryStorage({ [SESSION_KEY]: "rt-1" })));
    expect(auth.refreshSession).toHaveBeenCalledWith({ refresh_token: "rt-1" });
  });

  it("forgets a token Supabase no longer accepts, and does nothing without one", async () => {
    const storage = memoryStorage({ [SESSION_KEY]: "old" });
    const { client } = fakeClient({ refreshError: true });
    await restoreSession(client, hostWith(storage));
    expect(storage.data.has(SESSION_KEY)).toBe(false);

    const fresh = fakeClient();
    await restoreSession(fresh.client, hostWith(memoryStorage()));
    expect(fresh.auth.refreshSession).not.toHaveBeenCalled();
  });
});

describe("keepSession", () => {
  it("saves each new refresh token and deletes it on sign-out", async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const { client, emit } = fakeClient();
    keepSession(client, hostWith(storage));
    emit("TOKEN_REFRESHED", { refresh_token: "rt-2" });
    await vi.runAllTimersAsync();
    expect(storage.data.get(SESSION_KEY)).toBe("rt-2");
    emit("SIGNED_OUT", null);
    await vi.runAllTimersAsync();
    expect(storage.data.has(SESSION_KEY)).toBe(false);
  });
});

describe("signInWithPopup", () => {
  const CALLBACK_ORIGIN = "https://carthavate.github.io";

  it("sends the popup to GitHub sign-in and exchanges the code the website posts back", async () => {
    const { client, auth } = fakeClient();
    const popup = { closed: false, location: { href: "about:blank" }, close: vi.fn() } as unknown as Window;
    const done = signInWithPopup(client, popup, "github");
    await vi.waitFor(() => expect(popup.location.href).toBe("https://supabase.example/authorize?provider=github"));
    // A message from another window on the website's origin is ignored; the popup's own is accepted.
    window.dispatchEvent(new MessageEvent("message", { data: { type: "arena-auth", code: "other" }, origin: CALLBACK_ORIGIN, source: window }));
    window.dispatchEvent(new MessageEvent("message", { data: { type: "arena-auth", code: "one-time" }, origin: CALLBACK_ORIGIN, source: popup as unknown as MessageEventSource }));
    await done;
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: "https://carthavate.github.io/ai-engineering-arena/anna-callback.html", skipBrowserRedirect: true },
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("one-time");
  });

  it("signs in with Google the same way", async () => {
    const { client, auth } = fakeClient();
    const popup = { closed: false, location: { href: "about:blank" }, close: vi.fn() } as unknown as Window;
    const done = signInWithPopup(client, popup, "google");
    await vi.waitFor(() => expect(popup.location.href).not.toBe("about:blank"));
    window.dispatchEvent(new MessageEvent("message", { data: { type: "arena-auth", code: "g-code" }, origin: CALLBACK_ORIGIN, source: popup as unknown as MessageEventSource }));
    await done;
    expect(auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" }));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("g-code");
  });

  it("ignores codes from any other origin and fails when the popup is closed", async () => {
    vi.useFakeTimers();
    const { client, auth } = fakeClient();
    const popup = { closed: false, location: { href: "about:blank" }, close: vi.fn() } as unknown as Window & { closed: boolean };
    const done = signInWithPopup(client, popup, "github");
    const outcome = expect(done).rejects.toThrow(/closed before you finished/);
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new MessageEvent("message", { data: { type: "arena-auth", code: "stolen" }, origin: "https://anna.partners" }));
    window.dispatchEvent(new MessageEvent("message", { data: { type: "arena-auth", code: "stolen" }, origin: "https://evil.example" }));
    popup.closed = true;
    await vi.advanceTimersByTimeAsync(4000);
    await outcome;
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("annaAuth sign-in", () => {
  const CALLBACK_ORIGIN = "https://carthavate.github.io";
  const fromPopup = (popup: Window, code: string) =>
    window.dispatchEvent(new MessageEvent("message", { data: { type: "arena-auth", code }, origin: CALLBACK_ORIGIN, source: popup as unknown as MessageEventSource }));

  it("clicking Sign in again replaces the attempt still waiting, quietly", async () => {
    const { client, auth } = fakeClient();
    // window.open with the same name gives back the same popup, as browsers do.
    const popup = { closed: false, location: { href: "about:blank" }, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const port = annaAuth(client);

    const first = port.signIn("github");
    await vi.waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1));
    const second = port.signIn("github");
    await vi.waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledTimes(2));
    fromPopup(popup, "latest");
    await Promise.all([first, second]);

    // Only the newest attempt exchanges the code (it holds the PKCE verifier), and the old one says nothing.
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("latest");
    expect(alert).not.toHaveBeenCalled();
  });

  it("logs why Supabase refused a code, and tells the player", async () => {
    const { client, auth } = fakeClient();
    const refusal = { name: "AuthPKCECodeVerifierMissingError", message: "PKCE code verifier not found in storage." };
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error: refusal } as never);
    const popup = { closed: false, location: { href: "about:blank" }, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const done = annaAuth(client).signIn("google");
    await vi.waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalled());
    fromPopup(popup, "code");
    await done;

    expect(alert).toHaveBeenCalledWith("Sign-in failed: the sign-in code was refused. Try again.");
    expect(logged.mock.calls.flat()).toContain(refusal);
  });
});

describe("openSignInPopup", () => {
  it("opens a blank popup at once, inside the click", () => {
    const popup = {} as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    expect(openSignInPopup()).toBe(popup);
    expect(open).toHaveBeenCalledWith("about:blank", "arena-sign-in", "popup,width=520,height=720");
  });

  it("explains a blocked popup", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => openSignInPopup()).toThrow(/blocked the sign-in window/);
  });
});
