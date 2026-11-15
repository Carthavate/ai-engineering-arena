import { peekOf, type PeekState, type Peek } from "../../../logic/lab/ragPeek";
import { captionOf, PARTS, type PartId } from "../../../logic/lab/ragTour";

/** Characters of a stored chunk shown per row before it is cut with an ellipsis. */
const ROW_CHARS = 52;

function clip(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

function Body({ peek }: { readonly peek: Peek }) {
  switch (peek.kind) {
    case "files":
      return (
        <ul className="peek-list">
          {peek.files.map((f) => (
            <li key={f.name}><code>{f.name}</code> <span className="peek-dim">{f.chunks} chunks</span><br />{clip(f.first, 60)}</li>
          ))}
        </ul>
      );
    case "chunks":
      return (
        <>
          <p className="peek-dim"><code>{peek.source}</code> becomes {peek.chunks.length} of the {peek.total} chunks:</p>
          <ol className="peek-chunks">{peek.chunks.map((c) => <li key={c}>{c}</li>)}</ol>
        </>
      );
    case "vector":
      return (
        <>
          <p className="peek-dim">“{clip(peek.text, 60)}” becomes</p>
          <p className="peek-vector">[ {peek.words.map(([w, x], i) => <span key={w}>{i > 0 && ", "}<b>{x.toFixed(2)}</b><small>{w}</small></span>)} ]</p>
          <p className="peek-dim">Real models output hundreds of numbers that capture meaning. This toy weighs words.</p>
        </>
      );
    case "rows":
      return (
        <>
          <table className="peek-table">
            <tbody>
              {peek.rows.map((r) => (
                <tr key={r.id} className={r.hit ? "is-hit" : ""}>
                  <td className="peek-score">{r.score === undefined ? "·" : r.score.toFixed(2)}</td>
                  <td>{clip(r.text, ROW_CHARS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="peek-dim">
            {peek.rows.some((r) => r.score !== undefined) ? "Ranked by similarity to the question; highlighted rows go to the prompt. " : "Retrieval is off: nothing is searched. "}
            {peek.total - peek.rows.length} more rows.
          </p>
        </>
      );
    case "question":
      return <p className="peek-quote">“{peek.text}”</p>;
    case "prompt":
      return (
        <>
          {/* The whole prompt, one block per line, wrapped so nothing is cut. */}
          <div className="peek-pre">
            {peek.text.split("\n").map((line, i) => <div key={i} className="peek-line">{line}</div>)}
          </div>
          <p className="peek-dim">{peek.sources ? `${peek.sources} sources pasted in before the question.` : "No sources: just the question."}</p>
        </>
      );
    case "model":
      return (
        <p>
          Reads <b>{peek.inputWords} words</b> of prompt and predicts the answer one token at a time.{" "}
          {peek.retrievalOn ? "Here it can copy facts from the sources." : "With no sources, it can only lean on its training data."}
        </p>
      );
    case "answer":
      return (
        <p className={`peek-answer answer-${peek.answer.kind}`}>
          {peek.answer.text}
          {peek.answer.kind === "grounded" && <> <code>({peek.answer.source})</code></>}
        </p>
      );
  }
}

function Intro({ onInspect }: { readonly onInspect: (id: PartId) => void }) {
  return (
    <div className="inspector-intro">
      <div>
        <p className="play-kicker">RAG in one line</p>
        <h3>Look it up first, then answer.</h3>
        <p>
          An LLM only knows what it saw in training. Retrieval-augmented generation finds the relevant passages in <em>your</em> documents
          and puts them in the prompt, so the answer is current, specific and cites its source.
        </p>
      </div>
      <div>
        <p className="play-kicker">Hover a part to look inside</p>
        <ul className="play-parts">
          {PARTS.map((p) => (
            <li key={p.id}><button type="button" className="link-btn" onClick={() => onInspect(p.id)}>{p.label}</button></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface Props {
  readonly inspected: PartId | null;
  readonly onInspect: (id: PartId | null) => void;
  /** The question and retrieval switch the "inside" view describes. */
  readonly state: PeekState;
}

/** Docked under the drawing: what the inspected part does, and what it holds right now for the current question. */
export function RagInspector({ inspected, onInspect, state }: Props) {
  const part = PARTS.find((p) => p.id === inspected);
  return (
    <section id="rag-inspector" className="inspector" aria-label="Inspector">
      {part ? (
        <>
          <div className="inspector-head">
            <p className="play-kicker">{captionOf(part, state.retrievalOn)}</p>
            <h3>{part.label}</h3>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => onInspect(null)}>Close</button>
          </div>
          <div className="inspector-cols">
            <div className="inspector-what">
              <h4>What it does</h4>
              <p>{part.detail}</p>
            </div>
            <div className="inspector-inside">
              <h4>Inside, right now</h4>
              <Body peek={peekOf(part.id, state)} />
            </div>
          </div>
        </>
      ) : (
        <Intro onInspect={onInspect} />
      )}
    </section>
  );
}
