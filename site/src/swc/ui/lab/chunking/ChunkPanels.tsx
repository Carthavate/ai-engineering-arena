import { boundaryIsClean, CHUNK_QUESTIONS, type AnswerCheck, type Chunk } from "../../../logic/lab/chunking";

interface InspectorProps {
  readonly text: string;
  readonly chunks: readonly Chunk[];
  readonly index: number;
  readonly onIndex: (i: number) => void;
}

/** One chunk up close: its text, its length, whether its edges break a sentence, and what it shares with its neighbours. */
export function ChunkInspector({ text, chunks, index, onIndex }: InspectorProps) {
  const c = chunks[index];
  if (!c) return null;
  const prev = chunks[index - 1];
  const shared = prev ? Math.max(0, prev.end - c.start) : 0;
  const flags = [
    ...(boundaryIsClean(text, c.start) ? [] : ["Starts mid-sentence"]),
    ...(boundaryIsClean(text, c.end) ? [] : ["Ends mid-sentence"]),
  ];
  return (
    <section className="ck-card" aria-labelledby="ck-inspector-title">
      <div className="ck-card-head">
        <h3 id="ck-inspector-title">Chunk {index + 1} <span className="peek-dim">of {chunks.length}</span></h3>
        <div className="ck-step">
          <button type="button" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Previous chunk">←</button>
          <button type="button" onClick={() => onIndex(index + 1)} disabled={index === chunks.length - 1} aria-label="Next chunk">→</button>
        </div>
      </div>
      <p className="ck-facts">
        <span>{c.end - c.start} characters</span>
        {shared > 0 && <span>shares {shared} with chunk {index}</span>}
        {flags.map((f) => <span key={f} className="ck-flag">{f}</span>)}
        {flags.length === 0 && <span className="ck-ok">Whole sentences</span>}
      </p>
      <p className="ck-text">{text.slice(c.start, c.end)}</p>
    </section>
  );
}

const VERDICT_TEXT: Record<AnswerCheck["verdict"], string> = {
  whole: "✓ It holds the whole answer, so the model can answer.",
  missed: "The whole answer is in another chunk, but its words didn't match the question as well. Bigger, mixed chunks dilute the match.",
  split: "✗ No chunk holds the whole answer: a cut runs through it. Whichever chunk is retrieved, the model sees only part of the sentence.",
  nothing: "Retrieval found no chunk sharing a word with the question, so the model gets no context at all.",
  absent: "Your edited text doesn't contain this answer, so there is nothing to check.",
};

interface AnswerProps {
  readonly question: number;
  readonly onQuestion: (i: number) => void;
  readonly check: AnswerCheck;
}

/** Ask a question, see the chunk retrieval returns, and whether the whole answer made it into that chunk. */
export function AnswerPanel({ question, onQuestion, check }: AnswerProps) {
  return (
    <section className="ck-card" aria-labelledby="ck-answer-title">
      <h3 id="ck-answer-title">Does the answer survive?</h3>
      <div className="bp-chips" role="group" aria-label="Question">
        {CHUNK_QUESTIONS.map((q, i) => (
          <button key={q.text} type="button" aria-pressed={i === question} className={i === question ? "is-on" : ""} onClick={() => onQuestion(i)}>
            {q.text}
          </button>
        ))}
      </div>
      {check.top !== null && (
        <p>Retrieval returns <b>chunk {check.top + 1}</b> <span className="peek-dim">(score {check.score.toFixed(2)})</span>.</p>
      )}
      <p className={`ck-verdict verdict-${check.verdict}`} aria-live="polite">
        {VERDICT_TEXT[check.verdict]}
        {check.verdict === "split" && check.spans.length > 1 && <> It runs across chunks {check.spans.map((i) => i + 1).join(" and ")}.</>}
      </p>
      <p className="peek-dim">The answer is underlined in the document. Retrieval here is the toy word-overlap search from How RAG works.</p>
    </section>
  );
}
