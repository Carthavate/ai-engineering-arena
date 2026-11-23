// @vitest-environment jsdom
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keepSession, restoreSession, SESSION_KEY, signInWithPopup } from "./auth";
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
  it("opens GitHub sign-in in a popup and exchanges the code it sends back", async () => {
    const { client, auth } = fakeClient();
    const popup = { closed: false } as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    const done = signInWithPopup(client);
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    window.dispatchEvent(new MessageEvent("message", { data: { type: "arena-auth", code: "one-time" }, origin: window.location.origin }));
    await done;
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: new URL("auth-callback.html", document.baseURI).href, skipBrowserRedirect: true },
    });
    expect(open.mock.calls[0][0]).toBe("https://supabase.example/authorize?provider=github");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("one-time");
  });

  it("ignores messages from other origins and fails when the popup is closed", async () => {
    vi.useFakeTimers();
    const { client, auth } = fakeClient();
    const popup = { closed: false } as { closed: boolean };
    vi.spyOn(window, "open").mockReturnValue(popup as Window);
    const done = signInWithPopup(client);
    const outcome = expect(done).rejects.toThrow(/closed before you finished/);
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new MessageEvent("message", { data: { type: "arena-auth", code: "stolen" }, origin: "https://evil.example" }));
    popup.closed = true;
    await vi.advanceTimersByTimeAsync(2500);
    await outcome;
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("explains a blocked popup", async () => {
    const { client } = fakeClient();
    vi.spyOn(window, "open").mockReturnValue(null);
    await expect(signInWithPopup(client)).rejects.toThrow(/blocked the sign-in window/);
  });
});
