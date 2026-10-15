import type { LibraryPort } from "../../rte/ports";
import type { PersonalNote } from "../../swc/logic/ask/documents";
import type { Vec } from "../../swc/logic/lab/vectors";

const DB_NAME = "ai-arena-library";
const NOTES = "notes";
const VECTORS = "vectors";

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted (storage full?)"));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(NOTES)) db.createObjectStore(NOTES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(VECTORS)) db.createObjectStore(VECTORS);
    };
    r.onsuccess = () => {
      const db = r.result;
      // A newer version of the site opened the database: let it upgrade instead of blocking it.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    r.onerror = () => reject(r.error ?? new Error("Couldn't open IndexedDB"));
    r.onblocked = () => reject(new Error("IndexedDB is blocked by another tab"));
  });
}

function isNote(x: unknown): x is PersonalNote {
  const n = x as Partial<PersonalNote> | null;
  return Boolean(n) && typeof n!.id === "string" && typeof n!.title === "string" && typeof n!.text === "string" && typeof n!.addedAt === "string"
    && (n!.itemId === undefined || typeof n!.itemId === "string");
}

/** Notes and cached embeddings in IndexedDB: private to this browser, never sent to a server. */
export function browserLibrary(): LibraryPort {
  // Session-only copies when IndexedDB is unavailable (some private windows) or full.
  const memNotes = new Map<string, PersonalNote>();
  const memVectors = new Map<string, Vec>();
  let db: Promise<IDBDatabase> | null = null;

  const withDb = async <T,>(what: string, fn: (db: IDBDatabase) => Promise<T>): Promise<T | null> => {
    if (typeof indexedDB === "undefined") return null;
    try {
      db ??= openDb();
      return await fn(await db);
    } catch (err) {
      console.error(`Local library: ${what} failed`, err);
      db = null; // try opening again next time
      return null;
    }
  };

  return {
    async loadNotes() {
      const stored = await withDb("loading notes", async (d) => (await request(d.transaction(NOTES).objectStore(NOTES).getAll())) as unknown[]);
      const notes = new Map<string, PersonalNote>((stored ?? []).filter(isNote).map((n) => [n.id, n]));
      memNotes.forEach((n, id) => notes.set(id, n));
      return [...notes.values()].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    },

    async saveNote(note) {
      const ok = await withDb("saving a note", async (d) => {
        const tx = d.transaction(NOTES, "readwrite");
        tx.objectStore(NOTES).put(note);
        await done(tx);
        return true;
      });
      if (ok) return true;
      memNotes.set(note.id, note);
      return false;
    },

    async deleteNote(id) {
      memNotes.delete(id);
      await withDb("deleting a note", async (d) => {
        const tx = d.transaction(NOTES, "readwrite");
        tx.objectStore(NOTES).delete(id);
        await done(tx);
        return true;
      });
    },

    async getVectors(keys) {
      const found = await withDb("reading embeddings", async (d) => {
        const store = d.transaction(VECTORS).objectStore(VECTORS);
        return Promise.all(keys.map((k) => request(store.get(k) as IDBRequest<Vec | undefined>)));
      });
      return new Map(keys.flatMap((k, i) => {
        const v = found?.[i] ?? memVectors.get(k);
        return v ? [[k, v] as const] : [];
      }));
    },

    async putVectors(entries) {
      const ok = await withDb("caching embeddings", async (d) => {
        const tx = d.transaction(VECTORS, "readwrite");
        const store = tx.objectStore(VECTORS);
        entries.forEach((v, k) => store.put(v, k));
        await done(tx);
        return true;
      });
      if (!ok) entries.forEach((v, k) => memVectors.set(k, v));
    },

    async deleteVectors(keys) {
      keys.forEach((k) => memVectors.delete(k));
      await withDb("deleting embeddings", async (d) => {
        const tx = d.transaction(VECTORS, "readwrite");
        const store = tx.objectStore(VECTORS);
        keys.forEach((k) => store.delete(k));
        await done(tx);
        return true;
      });
    },
  };
}
