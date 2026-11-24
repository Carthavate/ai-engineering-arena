// The Anna App runtime: the host page that runs the Arena as an app on anna.partners.
// Only the methods the Arena uses are typed here; see https://anna.partners/developers/reference.

/** Served by the host page, never bundled (Anna allows it in the app's script-src). */
export const ANNA_SDK_URL = "/static/anna-apps/_sdk/latest/index.js";

export interface HostMessage {
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
}

export interface HostCompletion {
  readonly content: { readonly type: string; readonly text?: string };
  readonly stopReason: string;
}

export interface HostEmbeddings {
  readonly data: readonly { readonly index: number; readonly embedding: readonly number[] }[];
}

export interface HostStorageItem {
  readonly key: string;
}

/** The slice of `AnnaAppRuntime` the Arena calls. */
export interface AnnaHost {
  readonly llm: {
    complete(args: {
      readonly messages: readonly HostMessage[];
      readonly maxTokens?: number;
      readonly temperature?: number;
      readonly systemPrompt?: string;
    }): Promise<HostCompletion>;
    embed(args: { readonly input: readonly string[] }): Promise<HostEmbeddings>;
  };
  /** This app's private per-user bucket on Anna's servers (no other app can read it). */
  readonly storage: {
    get(args: { readonly key: string }): Promise<{ readonly value: unknown; readonly exists: boolean }>;
    set(args: { readonly key: string; readonly value: unknown }): Promise<unknown>;
    delete(args: { readonly key: string }): Promise<unknown>;
    list(args: { readonly prefix: string; readonly cursor?: string }): Promise<{
      readonly items: readonly HostStorageItem[];
      readonly next_cursor: string | null;
    }>;
  };
}

interface AnnaSdk {
  readonly AnnaAppRuntime: { connect(): Promise<AnnaHost> };
}

/** Load the SDK from the host and connect to it. Rejects outside Anna (e.g. on the public website). */
export async function connectAnna(): Promise<AnnaHost> {
  const sdk = (await import(/* @vite-ignore */ ANNA_SDK_URL)) as AnnaSdk;
  return sdk.AnnaAppRuntime.connect();
}

/** A player-facing message for a failed host call (Anna's errors carry a code like APP_QUOTA_EXCEEDED). */
export function hostError(error: unknown, what: string): Error {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code.includes("QUOTA")) return new Error(`${what}: your Anna credits are used up for now.`);
  if (code.includes("NOT_GRANTED")) return new Error(`${what}: install or enable the app in Anna first.`);
  return new Error(`${what}: Anna's AI service didn't answer. Try again in a moment.`);
}
