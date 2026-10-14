import type { LibraryPort } from "../../rte/ports";
import type { PersonalNote } from "../../swc/logic/ask/documents";
import type { Vec } from "../../swc/logic/lab/vectors";

const DB_NAME = "ai-arena-library";
const NOTES = "notes";
const VECTORS = "vectors";

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains(NOTES)) db.createObjectStore(NOTES, { keyPath: "id" });
    if (!db.objectStoreNames.contains(VECTORS)) db.createObjectStore(VECTORS);
  };
  return request(r);
}

/** In-memory fallback when IndexedDB is unavailable (some private windows): works, but forgets on reload. */
function memoryLibrary(): LibraryPort {
  const notes = new Map<string, PersonalNote>();
  const vectors = new Map<string, Vec>();
  return {
    loadNotes: async () => [...notes.values()],
    saveNote: async (n) => void notes.set(n.id, n),
    deleteNote: async (id) => void notes.delete(id),
    getVectors: async (keys) => new Map(keys.flatMap((k) => (vectors.has(k) ? [[k, vectors.get(k)!] as const] : []))),
    putVectors: async (entries) => entries.forEach((v, k) => vectors.set(k, v)),
  };
}

/** Notes and cached embeddings in IndexedDB: private to this browser, never sent to a server. */
export function browserLibrary(): LibraryPort {
  if (typeof indexedDB === "undefined") return memoryLibrary();
  let db: Promise<IDBDatabase> | null = null;
  const fallback = memoryLibrary();
  const withDb = async <T,>(fn: (db: IDBDatabase) => Promise<T>, onFail: () => Promise<T>): Promise<T> => {
    try {
      db ??= openDb();
      return await fn(await db);
    } catch (err) {
      console.error("Local library unavailable, using memory", err);
      return onFail();
    }
  };

  return {
    loadNotes: () => withDb(async (d) => {
      const all = (await request(d.transaction(NOTES).objectStore(NOTES).getAll())) as PersonalNote[];
      return all.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
    }, fallback.loadNotes),

    saveNote: (note) => withDb(async (d) => {
      const tx = d.transaction(NOTES, "readwrite");
      tx.objectStore(NOTES).put(note);
      await done(tx);
    }, () => fallback.saveNote(note)),

    deleteNote: (id) => withDb(async (d) => {
      const tx = d.transaction(NOTES, "readwrite");
      tx.objectStore(NOTES).delete(id);
      await done(tx);
    }, () => fallback.deleteNote(id)),

    getVectors: (keys) => withDb(async (d) => {
      const store = d.transaction(VECTORS).objectStore(VECTORS);
      const found = await Promise.all(keys.map((k) => request(store.get(k) as IDBRequest<Vec | undefined>)));
      return new Map(keys.flatMap((k, i) => (found[i] ? [[k, found[i]!] as const] : [])));
    }, () => fallback.getVectors(keys)),

    putVectors: (entries) => withDb(async (d) => {
      const tx = d.transaction(VECTORS, "readwrite");
      const store = tx.objectStore(VECTORS);
      entries.forEach((v, k) => store.put(v, k));
      await done(tx);
    }, () => fallback.putVectors(entries)),
  };
}
