import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAskCourse, type AddNotesResult, type AskTurn } from "../../../rte/useAskCourse";
import type { Chunk } from "../../logic/ask/documents";

const AI_KEY = "ai-eng-lab:ask-ai";
const MAX_FILE_BYTES = 2_000_000;
const SUGGESTIONS = [
  "How does reciprocal rank fusion work?",
  "When should I use BM25 instead of embeddings?",
  "Why add chunk overlap?",
  "What does MMR do?",
];

function loadAiPref(): boolean {
  try {
    return localStorage.getItem(AI_KEY) === "1";
  } catch {
    return false;
  }
}

function saveAiPref(on: boolean): void {
  try {
    localStorage.setItem(AI_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}

/** "Chunking 3f2a…9c.md" (Notion export) -> "Chunking". */
function noteTitle(fileName: string): string {
  return fileName.replace(/\.(md|markdown|txt)$/i, "").replace(/\s+[0-9a-f]{32}$/i, "").trim();
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function where(c: Chunk): string {
  return `${c.title}${c.heading ? ` › ${c.heading}` : ""}`;
}

/** Answer text with [n] turned into links to the matching source card. */
function withCitations(answer: string, turnId: number, sourceCount: number): ReactNode[] {
  return answer.split(/(\[\d+\])/g).map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part);
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= sourceCount
      ? (
        <button key={i} type="button" className="cite" aria-label={`Source ${n}`}
          onClick={() => {
            const card = document.getElementById(`src-${turnId}-${n}`);
            card?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
            card?.focus({ preventScroll: true });
          }}>{n}</button>
      )
      : <span key={i}>{part}</span>;
  });
}

function Pipeline({ turn }: { readonly turn: AskTurn }) {
  const { trace, pool, prompt } = turn;
  if (!trace) return null;
  const name = (i: number) => where(pool[i]);
  return (
    <details className="pipeline">
      <summary>How this answer was made</summary>
      <ol className="pipeline-steps">
        <li>
          <b>Question</b>
          <span>{turn.searchQuery !== turn.question ? <>Your follow-up was rewritten into a standalone question (lesson #7): <q>{turn.searchQuery}</q></> : <q>{turn.searchQuery}</q>}</span>
        </li>
        <li>
          <b>Keyword search (BM25, lesson #16)</b>
          {trace.keyword.length === 0 ? <span className="muted">No exact keyword matches.</span> : (
            <ol className="hit-list">{trace.keyword.slice(0, 5).map((h) => <li key={h.index}><span>{name(h.index)}</span><code>{h.score.toFixed(2)}</code></li>)}</ol>
          )}
        </li>
        <li>
          <b>Meaning search (embeddings + cosine, lessons #2 and #5)</b>
          <ol className="hit-list">{trace.vector.slice(0, 5).map((h) => <li key={h.index}><span>{name(h.index)}</span><code>{h.score.toFixed(3)}</code></li>)}</ol>
        </li>
        <li>
          <b>Fusion (reciprocal rank fusion, k = 60, lesson #15)</b>
          <table className="fusion-table">
            <thead><tr><th scope="col">Chunk</th><th scope="col">Meaning rank</th><th scope="col">Keyword rank</th><th scope="col">RRF score</th></tr></thead>
            <tbody>
              {trace.fused.slice(0, 6).map((f) => (
                <tr key={f.index} className={trace.picked.includes(f.index) ? "picked" : ""}>
                  <td>{name(f.index)}{trace.picked.includes(f.index) && <span className="solved-pill">sent to the model</span>}</td>
                  <td>{f.ranks[0] ?? "–"}</td>
                  <td>{f.ranks[1] ?? "–"}</td>
                  <td><code>{f.score.toFixed(4)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
        {prompt && (
          <li>
            <b>Prompt (lesson #6)</b>
            <pre className="prompt-view">{prompt.map((m) => `[${m.role}]\n${m.content}`).join("\n\n")}</pre>
          </li>
        )}
        {turn.citationsMatched && (
          <li>
            <b>Citations</b>
            <span>The small model doesn't cite reliably, so each sentence of its answer was matched afterwards to the source it overlaps most (BM25 over the sources sent to the model).</span>
          </li>
        )}
      </ol>
    </details>
  );
}

function Turn({ turn }: { readonly turn: AskTurn }) {
  return (
    <li className="ask-turn">
      <p className="bubble me"><span className="sr-only">You: </span>{turn.question}</p>
      {turn.status === "searching" && <p className="bubble bot muted">Searching the course…</p>}
      {turn.status === "error" && <p className="bubble bot form-error">{turn.error}</p>}
      {(turn.status === "answering" || turn.answer) && (
        <p className={`bubble bot${turn.status === "answering" ? " streaming" : ""}`} aria-busy={turn.status === "answering"}>
          <span className="sr-only">Assistant: </span>
          {turn.answer ? withCitations(turn.answer, turn.id, turn.sources.length) : "Writing the answer…"}
        </p>
      )}
      {turn.status === "stopped" && <p className="bubble bot muted">Stopped.</p>}
      {turn.status === "done" && turn.trace && turn.sources.length === 0 && (
        <p className="bubble bot">Nothing in the course notes or your notes matches that. Try other words, or ask about a RAG topic.</p>
      )}
      {turn.status === "done" && !turn.answer && turn.sources.length > 0 && (
        <p className="bubble bot">{turn.usedAi ? "The AI didn't write an answer this time; here are the most relevant passages." : "Here are the most relevant passages. Turn on the local AI to get a written answer."}</p>
      )}
      {turn.sources.length > 0 && (
        <ol className="source-cards">
          {turn.sources.map((c, i) => (
            <li key={c.id} id={`src-${turn.id}-${i + 1}`} tabIndex={-1}>
              <div className="source-head">
                <span className="cite static">{i + 1}</span>
                <span className={`kind-tag ${c.kind}`}>{c.kind === "lecture" ? "Lecture" : "Your note"}</span>
                <b>{where(c)}</b>
                {c.url && <a href={c.url} target="_blank" rel="noopener">Watch ↗</a>}
              </div>
              <p>{c.text.length > 280 ? `${c.text.slice(0, 280)}…` : c.text}</p>
            </li>
          ))}
        </ol>
      )}
      <Pipeline turn={turn} />
    </li>
  );
}

function NotesPanel({ course }: { readonly course: ReturnType<typeof useAskCourse> }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ readonly ok: boolean; readonly text: string } | null>(null);

  const report = (r: AddNotesResult, unreadable = 0, wrongType = 0) => {
    const parts = [`Added ${r.added} note${r.added === 1 ? "" : "s"}.`];
    if (r.duplicates) parts.push(`${r.duplicates} already there.`);
    if (wrongType) parts.push(`Skipped ${wrongType} (only .md / .txt up to 2 MB).`);
    if (unreadable) parts.push(`Couldn't read ${unreadable} (is it only in the cloud?).`);
    if (r.overLimit) parts.push(`${r.overLimit} didn't fit: notes are capped at about 3 MB of text in total.`);
    if (r.sessionOnly) parts.push(`This browser blocks storage, so ${r.sessionOnly === r.added ? "they're" : `${r.sessionOnly} are`} kept only until you reload.`);
    setMessage({ ok: !r.sessionOnly && !r.overLimit && !unreadable, text: parts.join(" ") });
  };

  const onFiles = async (list: FileList | null) => {
    // Copy first: clearing the input empties the live FileList.
    const files = list ? [...list] : [];
    if (files.length === 0) return;
    const ok = files.filter((f) => f.size <= MAX_FILE_BYTES && /\.(md|markdown|txt)$/i.test(f.name));
    const read = await Promise.allSettled(ok.map(async (f) => ({ title: noteTitle(f.name), text: await f.text() })));
    const notes = read.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    try {
      report(await course.addNotes(notes), read.length - notes.length, files.length - ok.length);
    } catch (err) {
      console.error("Adding notes failed", err);
      setMessage({ ok: false, text: "Couldn't add those notes. Try again." });
    }
  };

  const onPaste = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      report(await course.addNotes([{ title: title || "Pasted note", text }]));
      setTitle("");
      setText("");
    } catch (err) {
      console.error("Adding a note failed", err);
      setMessage({ ok: false, text: "Couldn't add that note. Try again." });
    }
  };

  return (
    <section className="panel ask-notes" aria-labelledby="notes-title">
      <div className="panel-head">
        <h2 id="notes-title" className="panel-title">Your notes</h2>
        <span className="admin-tag">Private · this browser only</span>
      </div>
      <p className="muted small-text">
        Add your own notes and the assistant searches them too. Export your Notion pages as Markdown and pick the files, or paste text. They're stored only in this browser and never uploaded; removing a note also removes its embeddings.
      </p>
      <label className="btn btn-ghost btn-small file-pick">
        Add .md / .txt files
        <input type="file" accept=".md,.markdown,.txt" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      <form className="paste-note" onSubmit={(e) => void onPaste(e)}>
        <label className="sr-only" htmlFor="note-title">Note title</label>
        <input id="note-title" className="lab-input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="sr-only" htmlFor="note-text">Note text</label>
        <textarea id="note-text" className="lab-textarea" rows={4} placeholder="…or paste a note here" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-small" disabled={!text.trim()}>Add note</button>
      </form>
      {message && <p className={message.ok ? "players-ok" : "form-error"} role="status">{message.text}</p>}
      {course.notes.length > 0 && (
        <ul className="note-list">
          {course.notes.map((n) => (
            <li key={n.id}>
              <span>{n.title}</span>
              <span className="muted small-text">{n.text.length.toLocaleString()} characters</span>
              <button type="button" className="chip-x" aria-label={`Remove ${n.title}`} onClick={() => void course.removeNote(n.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "Ask the course": RAG over our lecture notes and your own notes, running entirely in the browser. */
export function AskCourse() {
  const course = useAskCourse();
  const [question, setQuestion] = useState("");
  const [useAi, setUseAi] = useState(loadAiPref);
  const endRef = useRef<HTMLDivElement>(null);
  const { index, ai, turns, busy } = course;

  useEffect(() => {
    if (turns.length > 0) endRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "end" });
  }, [turns.length]);

  const submit = (q: string) => {
    if (!q.trim() || busy || index.state !== "ready") return;
    setQuestion("");
    void course.ask(q, useAi);
  };

  const toggleAi = (on: boolean) => {
    setUseAi(on);
    saveAiPref(on);
  };

  const indexLine =
    index.state === "error" ? "Couldn't load the embedding model. Check your connection and reload."
    : index.state === "ready" ? `Ready · ${index.total} passages indexed`
    : index.modelPct !== null ? `Downloading the embedding model (first time only)… ${index.modelPct}%`
    : `Indexing ${index.embedded}/${index.total} passages…`;

  return (
    <div className="playground ask">
      <p className="banner info">
        Ask anything about the RAG course. The answer comes from our notes on each lecture and from your own notes, and the assistant shows exactly how it found them: keyword search, meaning search, reciprocal rank fusion and the prompt. Everything runs in your browser.
      </p>

      <section className="panel ask-chat" aria-labelledby="ask-title">
        <div className="panel-head">
          <h2 id="ask-title" className="panel-title">Ask the course</h2>
          <span className={`kernel-pill state-${index.state === "ready" ? "idle" : "loading"}`}>{indexLine}</span>
          {index.state === "error" && <button type="button" className="btn btn-ghost btn-small" onClick={course.retryIndex}>Retry</button>}
          <span className="sr-only" role="status">{index.state === "ready" ? "The course is ready for questions." : index.state === "error" ? indexLine : ""}</span>
        </div>

        {turns.length === 0 ? (
          <div className="ask-empty">
            <p className="muted">Try one of these:</p>
            <div className="tok-picker">
              {SUGGESTIONS.map((s) => <button key={s} type="button" className="chip-btn" onClick={() => submit(s)} disabled={busy || index.state !== "ready"}>{s}</button>)}
            </div>
          </div>
        ) : (
          <ol className="ask-turns">{turns.map((t) => <Turn key={t.id} turn={t} />)}</ol>
        )}
        <div ref={endRef} />

        <form className="ask-form" onSubmit={(e) => { e.preventDefault(); submit(question); }}>
          <label className="sr-only" htmlFor="ask-q">Your question</label>
          <input id="ask-q" className="lab-input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about chunking, retrieval, reranking…" autoComplete="off" />
          <button type="submit" className="btn btn-primary" disabled={busy || !question.trim() || index.state !== "ready"}>Ask</button>
          <button type="button" className="btn btn-ghost" onClick={course.stop} disabled={!busy}>Stop</button>
        </form>
        <div className="ask-options">
          <label className="tok-toggle">
            <input type="checkbox" checked={useAi} onChange={(e) => toggleAi(e.target.checked)} />
            Write answers with the local AI (Qwen2.5, about 800 MB the first time)
          </label>
          {ai.state === "loading" && <span className="muted small-text">Loading the AI{ai.pct !== null ? `… ${ai.pct}%` : "…"}</span>}
          {ai.state === "ready" && <span className="muted small-text">AI running on {ai.device === "webgpu" ? "your GPU" : "your CPU (slower)"}</span>}
          {ai.state === "error" && <span className="form-error small-text">The AI couldn't start here; you still get the best passages.</span>}
          {turns.length > 0 && <button type="button" className="btn-link" onClick={course.clear} disabled={busy}>Clear chat</button>}
        </div>
      </section>

      <NotesPanel course={course} />
    </div>
  );
}
