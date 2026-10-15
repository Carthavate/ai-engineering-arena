import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { hasPassed } from "../../logic/activity";
import { lectureNotes } from "../../logic/ask/coursePack";
import { itemXp } from "../../logic/gamify";
import { lessonStatus, locateLesson, type LessonStatus } from "../../logic/lesson";
import type { LabData } from "../labData";
import { Prose } from "../lab/Prose";
import { LessonAsk } from "./LessonAsk";
import { LessonFriends } from "./LessonFriends";
import { LessonNotes } from "./LessonNotes";
import { LessonVideo } from "./LessonVideo";
import "./lesson.css";

interface Props {
  readonly itemId: string;
  readonly data: LabData;
  /** Show another lesson in the panel. */
  readonly onGo: (itemId: string) => void;
  readonly onClose: () => void;
}

const STATE_TEXT: Record<LessonStatus, string> = {
  done: "Done ✓",
  passed: "Quiz passed ✓",
  "quiz-gate": "Pass the quiz with 4/5 to complete",
  todo: "Not done yet",
};

/** Typing in a field (or moving inside a player) must not flip lessons. */
function typing(target: EventTarget): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, iframe, [contenteditable='true']"));
}

/** Study one lesson without leaving the page: video, quiz, duel, scoped Ask, private notes, friends. */
export default function LessonPanel({ itemId, data, onGo, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [notesVersion, setNotesVersion] = useState(0);
  const idRef = useRef(itemId);
  idRef.current = itemId;

  // Open as a modal (focus moves in); on close, give focus back to the lesson's row.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!ref.current?.open) ref.current?.showModal();
    return () => {
      const row = document.querySelector<HTMLElement>(`[data-lesson-link="${CSS.escape(idRef.current)}"]`);
      const target = row ?? (opener?.isConnected ? opener : null);
      window.setTimeout(() => target?.focus(), 0);
    };
  }, []);

  // Another lesson: back to the top, and if the focused Previous/Next just got disabled (an end of the roadmap), focus the title.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    const focused = document.activeElement;
    if (focused === document.body || (focused instanceof HTMLButtonElement && focused.disabled)) titleRef.current?.focus();
  }, [itemId]);

  const place = locateLesson(itemId);
  if (!place) return null;
  const { phase, item, prev, next } = place;
  const { me, progress, quizResults, quizAvailable, members, onQuiz, onDuel, onToggle } = data;
  const hasQuiz = quizAvailable.has(item.id);
  const status = lessonStatus({
    done: Boolean(me && item.id in (progress[me.id] ?? {})),
    hasQuiz,
    passed: Boolean(me && hasPassed(quizResults, me.id, item.id)),
  });
  const notes = lectureNotes(item.id);

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
    const to = e.key === "ArrowLeft" || e.key === "[" ? prev : e.key === "ArrowRight" || e.key === "]" ? next : null;
    if (!to) return;
    e.preventDefault();
    onGo(to.id);
  };

  return (
    <dialog ref={ref} className="lesson" aria-labelledby="lesson-title" onClose={onClose} onKeyDown={onKeyDown}>
      <header className="lesson-head">
        <div className="lesson-head-text">
          <p className="ph-code">{phase.title}</p>
          <h2 id="lesson-title" ref={titleRef} tabIndex={-1}>{item.title}</h2>
          <div className="lesson-tags">
            <span className={`kind kind-${item.kind}`}>{item.kind}</span>
            <span className="xp-chip">+{itemXp(item)} XP</span>
            {me && <span className={`lesson-state state-${status}`}>{STATE_TEXT[status]}</span>}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => ref.current?.close()} aria-label="Close the lesson (Esc)">Close</button>
      </header>

      <div className="lesson-body" ref={bodyRef}>
        <LessonVideo key={item.id} item={item} />

        {(hasQuiz && onQuiz) || (status === "todo" && onToggle) ? (
          <div className="lesson-actions">
            {hasQuiz && onQuiz && <button type="button" className="btn btn-quiz" onClick={() => onQuiz(item)}>Quiz me</button>}
            {hasQuiz && onDuel && members.length > 1 && <button type="button" className="btn btn-duel" onClick={() => onDuel(item)}>Duel</button>}
            {status === "todo" && onToggle && (
              <button type="button" className="btn btn-primary btn-small" onClick={(e) => onToggle(item.id, true, e.currentTarget)}>Mark done</button>
            )}
          </div>
        ) : null}

        {notes.length > 0 && (
          <details className="lesson-section lesson-lecture" open>
            <summary><h3>Lecture notes</h3><span className="muted small-text">Our summary of the video</span></summary>
            {notes.map((s) => (
              <div key={s.heading} className="lesson-lecture-part">
                {s.heading && <h4>{s.heading}</h4>}
                <Prose text={s.body} />
              </div>
            ))}
          </details>
        )}

        <section className="lesson-section" aria-labelledby="lesson-ask-title">
          <div className="lesson-section-head">
            <h3 id="lesson-ask-title">Ask about this lecture</h3>
            {!askOpen && <button type="button" className="btn btn-ghost btn-small" onClick={() => setAskOpen(true)}>Start</button>}
          </div>
          {askOpen
            ? <LessonAsk item={item} hasLecture={notes.length > 0} notesVersion={notesVersion} />
            : <p className="muted small-text">Answers come only from this lecture's notes and your notes on it, with citations. Runs in your browser (the search model downloads once, about 25 MB).</p>}
        </section>

        <LessonNotes item={item} onSaved={() => setNotesVersion((v) => v + 1)} />

        <LessonFriends item={item} data={data} />
      </div>

      <span className="sr-only" aria-live="polite">{`Lesson: ${item.title}`}</span>

      <footer className="lesson-foot">
        <button type="button" className="btn btn-ghost btn-small" disabled={!prev} onClick={() => prev && onGo(prev.id)}
          aria-label={prev ? `Previous lesson: ${prev.title}` : "No previous lesson"}>← Previous</button>
        <span className="muted small-text lesson-keys" aria-hidden="true">← → or [ ]</span>
        <button type="button" className="btn btn-ghost btn-small" disabled={!next} onClick={() => next && onGo(next.id)}
          aria-label={next ? `Next lesson: ${next.title}` : "No next lesson"}>Next →</button>
      </footer>
    </dialog>
  );
}
