import { MAX_LESSON_NOTE_CHARS, useLessonNote, type LessonNoteStatus } from "../../../rte/useLessonNote";
import type { RoadmapItem } from "../../logic/roadmap";

const STATUS: Record<LessonNoteStatus, string> = {
  loading: "Loading your note…",
  idle: "Saves by itself as you type.",
  saving: "Saving…",
  saved: "Saved in this browser.",
  session: "This browser blocks storage, so this note is kept only until you reload.",
  error: "Couldn't save your note. Copy it somewhere safe and try again.",
  unavailable: "Couldn't open your notes in this browser. Reload to try again.",
};

const PROBLEMS: ReadonlySet<LessonNoteStatus> = new Set(["session", "error", "unavailable"]);

/** The player's private, autosaved note on this lesson. */
export function LessonNotes({ item, onSaved }: { readonly item: RoadmapItem; readonly onSaved: () => void }) {
  const note = useLessonNote(item, onSaved);
  return (
    <section className="lesson-section" aria-labelledby="lesson-notes-title">
      <div className="lesson-section-head">
        <h3 id="lesson-notes-title">My notes</h3>
        <span className="admin-tag">Private · this browser only</span>
      </div>
      <label className="sr-only" htmlFor="lesson-note">My notes on {item.title}</label>
      <textarea
        id="lesson-note"
        className="lab-textarea"
        rows={6}
        maxLength={MAX_LESSON_NOTE_CHARS}
        value={note.text}
        disabled={note.status === "loading" || note.status === "unavailable"}
        onChange={(e) => note.setText(e.target.value)}
        placeholder="What clicked, what didn't, questions for Thursday… Ask about this lecture searches these notes too."
      />
      {/* Only problems are announced; "Saving… Saved." on every pause would chatter in a screen reader. */}
      {PROBLEMS.has(note.status)
        ? <p className="small-text form-error" role="alert">{STATUS[note.status]}</p>
        : <p className="small-text muted">{STATUS[note.status]}</p>}
    </section>
  );
}
