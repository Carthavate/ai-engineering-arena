import type { ReactNode } from "react";
import type { AskTurn } from "../../../rte/useAskCourse";
import type { Chunk } from "../../logic/ask/documents";

const AI_KEY = "ai-eng-lab:ask-ai";

/** Whether the player chose to have the local AI write answers (shared by every Ask box). */
export function loadAiPref(): boolean {
  try {
    return localStorage.getItem(AI_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveAiPref(on: boolean): void {
  try {
    localStorage.setItem(AI_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function where(c: Chunk): string {
  return `${c.title}${c.heading ? ` › ${c.heading}` : ""}`;
}

/** Answer text with [n] turned into links to the matching source card. */
function withCitations(answer: string, anchor: string, sourceCount: number): ReactNode[] {
  return answer.split(/(\[\d+\])/g).map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part);
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= sourceCount
      ? (
        <button key={i} type="button" className="cite" aria-label={`Source ${n}`}
          onClick={() => {
            const card = document.getElementById(`${anchor}-${n}`);
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

/** One question and its answer, sources and pipeline. idPrefix keeps source anchors unique when two chats are on screen. */
export function Turn({ turn, idPrefix = "src" }: { readonly turn: AskTurn; readonly idPrefix?: string }) {
  const anchor = `${idPrefix}-${turn.id}`;
  return (
    <li className="ask-turn">
      <p className="bubble me"><span className="sr-only">You: </span>{turn.question}</p>
      {turn.status === "searching" && <p className="bubble bot muted">Searching the course…</p>}
      {turn.status === "error" && <p className="bubble bot form-error">{turn.error}</p>}
      {(turn.status === "answering" || turn.answer) && (
        <p className={`bubble bot${turn.status === "answering" ? " streaming" : ""}`} aria-busy={turn.status === "answering"}>
          <span className="sr-only">Assistant: </span>
          {turn.answer ? withCitations(turn.answer, anchor, turn.sources.length) : "Writing the answer…"}
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
            <li key={c.id} id={`${anchor}-${i + 1}`} tabIndex={-1}>
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
