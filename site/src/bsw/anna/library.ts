import type { LibraryPort } from "../../rte/ports";
import type { PersonalNote } from "../../swc/logic/ask/documents";
import type { Vec } from "../../swc/logic/lab/vectors";
import type { AnnaHost } from "./host";

const NOTE_PREFIX = "notes/";

/** Anna storage keys are paths: encode the id so it stays one safe segment. */
const noteKey = (id: string): string => NOTE_PREFIX + encodeURIComponent(id);

function isNote(value: unknown): value is PersonalNote {
  if (typeof value !== "object" || value === null) return false;
  const n = value as Record<string, unknown>;
  return typeof n.id === "string" && typeof n.title === "string" && typeof n.text === "string" && typeof n.addedAt === "string";
}

/**
 * The player's notes in the app's private Anna storage. Every Anna app is served from the same origin, so the
 * browser's own storage there is shared with other apps: notes never go into it, and embeddings (which can partly
 * reveal the text) are kept in memory only, recomputed once per session.
 */
export function annaLibrary(host: AnnaHost): LibraryPort {
  const vectors = new Map<string, Vec>();
  return {
    async loadNotes() {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await host.storage.list({ prefix: NOTE_PREFIX, ...(cursor ? { cursor } : {}) });
        keys.push(...page.items.map((i) => i.key));
        cursor = page.next_cursor ?? undefined;
      } while (cursor);
      const rows = await Promise.all(keys.map((key) => host.storage.get({ key })));
      return rows.map((r) => r.value).filter(isNote).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    },

    async saveNote(note) {
      try {
        await host.storage.set({ key: noteKey(note.id), value: note });
        return true;
      } catch (e) {
        console.error("Couldn't save the note in Anna", e);
        return false;
      }
    },

    async deleteNote(id) {
      await host.storage.delete({ key: noteKey(id) });
    },

    async getVectors(keys) {
      const found = new Map<string, Vec>();
      for (const k of keys) {
        const v = vectors.get(k);
        if (v) found.set(k, v);
      }
      return found;
    },

    async putVectors(entries) {
      for (const [k, v] of entries) vectors.set(k, v);
    },

    async deleteVectors(keys) {
      for (const k of keys) vectors.delete(k);
    },
  };
}
