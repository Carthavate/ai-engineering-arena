import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import type { Unsubscribe } from "../../rte/ports";

type Row = Record<string, unknown>;

/**
 * Listen to row changes on public tables. onReconnect fires when the channel re-subscribes after a drop,
 * because events may have been missed in between.
 */
export function watchTables(
  client: SupabaseClient,
  name: string,
  tables: ReadonlyArray<{ table: string; filter?: string; on: (p: RealtimePostgresChangesPayload<Row>) => void }>,
  onReconnect?: () => void,
): Unsubscribe {
  let subscribedBefore = false;
  let channel = client.channel(name);
  for (const t of tables) {
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table: t.table, filter: t.filter }, t.on);
  }
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    if (subscribedBefore) onReconnect?.();
    subscribedBefore = true;
  });
  return () => void client.removeChannel(channel);
}

/** How long to wait for a burst of deleted rows to end before reloading once. */
export const REMOVAL_RELOAD_MS = 500;

/** Run fn once, `ms` after the last call of a burst (e.g. the many rows one player delete removes). */
export function debounce(fn: () => void, ms: number): { readonly call: () => void; readonly cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    call: () => {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        fn();
      }, ms);
    },
    cancel,
  };
}
