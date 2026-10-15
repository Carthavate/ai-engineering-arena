import { useCallback, useEffect, useRef, useState } from "react";
import type { PersonalNote } from "../swc/logic/ask/documents";
import { lessonNoteId } from "../swc/logic/lesson";
import type { RoadmapItem } from "../swc/logic/roadmap";
import { useRte } from "./RteContext";
import { noteVectorKeys } from "./useAskCourse";

/** Wait this long after the last keystroke before saving. */
export const NOTE_SAVE_DELAY_MS = 700;
/** A lesson note is a scratchpad, not a book: keeps indexing fast. */
export const MAX_LESSON_NOTE_CHARS = 20_000;

/** unavailable: the note couldn't be read, so editing is blocked rather than risk overwriting it. */
export type LessonNoteStatus = "loading" | "idle" | "saving" | "saved" | "session" | "error" | "unavailable";

export interface LessonNote {
  readonly text: string;
  /** saved: stored in this browser; session: storage is blocked, kept only until reload. */
  readonly status: LessonNoteStatus;
  readonly setText: (text: string) => void;
}

interface Pending {
  readonly item: RoadmapItem;
  readonly text: string;
}

/**
 * The player's private note on one lesson, autosaved (debounced) through the LibraryPort.
 * It is a PersonalNote with an itemId, so "Ask the course" searches it like any other note.
 */
export function useLessonNote(item: RoadmapItem, onSaved?: () => void): LessonNote {
  const { library } = useRte();
  const [text, setTextState] = useState("");
  const [status, setStatus] = useState<LessonNoteStatus>("loading");
  const saved = useRef(new Map<string, PersonalNote | null>());
  const pending = useRef<Pending | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const itemRef = useRef(item);
  itemRef.current = item;

  const write = useCallback(async ({ item: it, text: raw }: Pending): Promise<LessonNoteStatus> => {
    const next = raw.slice(0, MAX_LESSON_NOTE_CHARS);
    // Never write over a note we couldn't read.
    if (!saved.current.has(it.id)) throw new Error("lesson note was not loaded");
    const before = saved.current.get(it.id) ?? null;
    if (next.trim() === (before?.text ?? "").trim()) return before ? "saved" : "idle";
    let durable = true;
    let kept = new Set<string>();
    if (next.trim()) {
      const note: PersonalNote = {
        id: lessonNoteId(it.id), itemId: it.id, title: `My notes: ${it.title}`, text: next, addedAt: before?.addedAt ?? new Date().toISOString(),
      };
      durable = await library.saveNote(note);
      saved.current.set(it.id, note);
      kept = new Set(noteVectorKeys(note));
    } else {
      await library.deleteNote(lessonNoteId(it.id));
      saved.current.set(it.id, null);
    }
    // Embeddings can partly reveal the text: forget the old version's (unchanged sections keep theirs).
    if (before) await library.deleteVectors(noteVectorKeys(before).filter((k) => !kept.has(k)));
    onSavedRef.current?.();
    return durable ? "saved" : "session";
  }, [library]);

  /** Save what's pending now (one save at a time, in order). */
  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    chain.current = chain.current.then(async () => {
      const showing = () => itemRef.current.id === job.item.id;
      if (showing()) setStatus("saving");
      try {
        const result = await write(job);
        if (showing() && !pending.current) setStatus(result);
      } catch (err) {
        console.error("Saving the lesson note failed", err);
        if (showing()) setStatus("error");
      }
    });
  }, [write]);

  // Load this lesson's note; switching lessons (or closing) saves what was typed first.
  useEffect(() => {
    let active = true;
    setStatus("loading");
    setTextState("");
    void chain.current.then(() => library.loadNotes()).then((notes) => {
      if (!active) return;
      const note = notes.find((n) => n.itemId === item.id) ?? null;
      saved.current.set(item.id, note);
      setTextState(note?.text ?? "");
      setStatus("idle");
    }, (err: unknown) => {
      console.error("Loading the lesson note failed", err);
      if (active) setStatus("unavailable");
    });
    return () => {
      active = false;
      flush();
    };
  }, [item.id, library, flush]);

  const setText = useCallback((value: string) => {
    const next = value.slice(0, MAX_LESSON_NOTE_CHARS);
    setTextState(next);
    pending.current = { item: itemRef.current, text: next };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, NOTE_SAVE_DELAY_MS);
  }, [flush]);

  return { text, status, setText };
}
