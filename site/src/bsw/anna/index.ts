import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Rte } from "../../rte/ports";
import { computeCore } from "../compute/core";
import { offline } from "../offline";
import { supabaseDuels, supabaseLive } from "../supabase/duels";
import { supabasePlayers } from "../supabase/players";
import { supabaseProgress } from "../supabase/progress";
import { supabaseQuizzes } from "../supabase/quizzes";
import { supabaseSolves } from "../supabase/solves";
import { annaAuth, keepSession, restoreSession } from "./auth";
import type { AnnaHost } from "./host";
import { annaLibrary } from "./library";
import { annaEmbedder, annaLlm } from "./models";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The same database as the website, with the session kept in memory: Anna serves every app from one origin, so
 * the browser storage there is shared with other apps. PKCE means the sign-in popup only ever sees a one-time code.
 */
function annaSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { flowType: "pkce", persistSession: false, detectSessionInUrl: false, autoRefreshToken: true },
  });
}

/** The basic software for the Arena as an Anna app: the website's ports, with Anna's AI, storage and sign-in. */
export async function createAnnaRte(host: AnnaHost): Promise<Rte> {
  const models = { ...computeCore, embedder: annaEmbedder(host), llm: annaLlm(host) };
  const library = annaLibrary(host);
  const client = annaSupabase();
  if (!client) return { configured: false, ...offline, ...models, library };
  await restoreSession(client, host);
  keepSession(client, host);
  return {
    configured: true,
    auth: annaAuth(client),
    progress: supabaseProgress(client),
    quizzes: supabaseQuizzes(client),
    duels: supabaseDuels(client),
    live: supabaseLive(client),
    players: supabasePlayers(client),
    solves: supabaseSolves(client),
    ...models,
    library,
  };
}
