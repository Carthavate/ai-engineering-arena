import { useEffect, useRef, useState } from "react";
import { useAskCourse } from "../../../rte/useAskCourse";
import { lessonNoteId } from "../../logic/lesson";
import type { RoadmapItem } from "../../logic/roadmap";
import { loadAiPref, saveAiPref, Turn } from "../lab/AskTurn";

interface Props {
  readonly item: RoadmapItem;
  /** We have lecture notes for this item (otherwise only the player's own note is searched). */
  readonly hasLecture: boolean;
  /** Bumped when the lesson note was saved, so the index picks up the new text. */
  readonly notesVersion: number;
}

/** "Ask the course", limited to this lecture's notes and the player's notes on it. */
export function LessonAsk({ item, hasLecture, notesVersion }: Props) {
  const course = useAskCourse();
  const [question, setQuestion] = useState("");
  const [useAi, setUseAi] = useState(loadAiPref);
  const { index, ai, turns, busy, reloadNotes } = course;
  const courseRef = useRef(course);
  courseRef.current = course;

  // Another lesson starts a fresh chat.
  useEffect(() => {
    courseRef.current.stop();
    courseRef.current.clear();
  }, [item.id]);

  useEffect(() => {
    if (notesVersion > 0) void reloadNotes();
  }, [notesVersion, reloadNotes]);

  const sourceIds = [...new Set([item.id, lessonNoteId(item.id), ...course.notes.filter((n) => n.itemId === item.id).map((n) => n.id)])];
  const ready = index.state === "ready";
  const submit = (q: string) => {
    if (!q.trim() || busy || !ready) return;
    setQuestion("");
    void course.ask(q, useAi, { sourceIds });
  };

  const indexLine =
    index.state === "error" ? "Couldn't load the embedding model."
    : ready ? "Ready"
    : index.modelPct !== null ? `Downloading the embedding model… ${index.modelPct}%`
    : `Indexing ${index.embedded}/${index.total}…`;
  const suggestions = (item.topics ?? []).slice(0, 3).map((t) => `Explain ${t}`);

  return (
    <div className="lesson-ask">
      <div className="lesson-ask-status">
        <span className={`kernel-pill state-${ready ? "idle" : "loading"}`}>{indexLine}</span>
        {index.state === "error" && <button type="button" className="btn btn-ghost btn-small" onClick={course.retryIndex}>Retry</button>}
        <span className="muted small-text">{hasLecture ? "Searches this lecture's notes and your notes on it." : "We have no lecture notes for this one yet, so only your notes below are searched."}</span>
      </div>

      {turns.length === 0 ? (
        suggestions.length > 0 && (
          <div className="tok-picker">
            {suggestions.map((s) => <button key={s} type="button" className="chip-btn" onClick={() => submit(s)} disabled={busy || !ready}>{s}</button>)}
          </div>
        )
      ) : (
        <ol className="ask-turns">{turns.map((t) => <Turn key={t.id} turn={t} idPrefix="lesson-src" />)}</ol>
      )}

      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); submit(question); }}>
        <label className="sr-only" htmlFor="lesson-ask-q">Your question about {item.title}</label>
        <input id="lesson-ask-q" className="lab-input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this lecture…" autoComplete="off" />
        <button type="submit" className="btn btn-primary" disabled={busy || !question.trim() || !ready}>Ask</button>
        <button type="button" className="btn btn-ghost" onClick={course.stop} disabled={!busy}>Stop</button>
      </form>
      <div className="ask-options">
        <label className="tok-toggle">
          <input type="checkbox" checked={useAi} onChange={(e) => { setUseAi(e.target.checked); saveAiPref(e.target.checked); }} />
          Write answers with the local AI (about 800 MB the first time)
        </label>
        {ai.state === "loading" && <span className="muted small-text">Loading the AI{ai.pct !== null ? `… ${ai.pct}%` : "…"}</span>}
        {ai.state === "error" && <span className="form-error small-text">The AI couldn't start here; you still get the best passages.</span>}
        {turns.length > 0 && <button type="button" className="btn-link" onClick={course.clear} disabled={busy}>Clear chat</button>}
      </div>
    </div>
  );
}
