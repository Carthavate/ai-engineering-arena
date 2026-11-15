import { useId, useState, type FormEvent } from "react";
import { href } from "../../../logic/route";
import { answer, buildPrompt, embed, EXAMPLE_QUESTIONS, KNOWLEDGE_BASE, retrieve, type Answer, type Hit } from "../../../logic/lab/ragToy";

const MAX_QUESTION_CHARS = 200;
/** How many of the question vector's heaviest words to show. */
const VECTOR_WORDS_SHOWN = 6;

interface Run {
  readonly question: string;
  readonly retrievalOn: boolean;
  readonly words: readonly (readonly [string, number])[];
  readonly hits: readonly Hit[];
  readonly prompt: string;
  readonly answer: Answer;
}

function runPipeline(question: string, retrievalOn: boolean): Run {
  const hits = retrievalOn ? retrieve(question) : [];
  const words = [...embed(question)].sort((a, b) => b[1] - a[1]).slice(0, VECTOR_WORDS_SHOWN);
  return {
    question,
    retrievalOn,
    words,
    hits,
    prompt: retrievalOn ? buildPrompt(question, hits) : `Question: ${question}`,
    answer: answer(question, hits, retrievalOn),
  };
}

const ANSWER_LABEL: Record<Answer["kind"], string> = {
  grounded: "Grounded answer",
  unknown: "Honest \"I don't know\"",
  guess: "Guess from training data · no sources",
};

function Results({ run }: { readonly run: Run }) {
  return (
    <div className="tryit-results">
      <div className="tryit-block">
        <h5>1 · Question → vector</h5>
        {run.words.length
          ? <p className="tryit-words">{run.words.map(([w, x]) => <span key={w} className="tryit-word">{w} <b>{x.toFixed(2)}</b></span>)}</p>
          : <p className="muted small-text">No meaningful words in this question.</p>}
      </div>

      <div className="tryit-block">
        <h5>2 · Closest chunks</h5>
        {!run.retrievalOn && <p className="muted small-text">Skipped: retrieval is off, so the model sees only the question.</p>}
        {run.retrievalOn && run.hits.length === 0 && <p className="muted small-text">No chunk shares a word with the question.</p>}
        {run.hits.length > 0 && (
          <ol className="tryit-hits">
            {run.hits.map((h) => (
              <li key={h.chunk.id}>
                <span className="tryit-score" style={{ ["--score" as string]: h.score.toFixed(3) }}><b>{h.score.toFixed(2)}</b></span>
                <span><code>{h.chunk.source}</code> {h.chunk.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <details className="tryit-block">
        <summary><h5>3 · Prompt sent to the LLM</h5></summary>
        <pre className="tryit-prompt">{run.prompt}</pre>
      </details>

      <div className={`tryit-answer answer-${run.answer.kind}`}>
        <h5>4 · {ANSWER_LABEL[run.answer.kind]}</h5>
        <p>{run.answer.text}{run.answer.kind === "grounded" && <> <code>({run.answer.source})</code></>}</p>
      </div>
    </div>
  );
}

interface TryItProps {
  /** The question last asked here, or null before the first one. */
  readonly asked: string | null;
  readonly retrievalOn: boolean;
  readonly onAsk: (question: string) => void;
  readonly onRetrieval: (on: boolean) => void;
}

/** Ask the toy RAG pipeline anything about the made-up bike shop, with retrieval on or off. */
export function RagTryIt({ asked, retrievalOn, onAsk, onRetrieval }: TryItProps) {
  const [question, setQuestion] = useState(asked ?? EXAMPLE_QUESTIONS[0].text);
  const inputId = useId();
  const trimmed = question.trim();
  const run = asked ? runPipeline(asked, retrievalOn) : null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed) onAsk(trimmed);
  };

  return (
    <div className="tryit">
      <p className="small-text">
        The shop's documents ({KNOWLEDGE_BASE.length} chunks): returns, warranty, the E2 e-bike manual, stores and delivery.
        Ask about them, or about anything else. The drawing's previews follow your question.
      </p>
      <div className="tryit-examples">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button key={q.text} type="button" className="chip-btn" onClick={() => { setQuestion(q.text); onAsk(q.text); }}>{q.text}</button>
        ))}
      </div>
      <form className="tryit-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={inputId}>Your question</label>
        <input id={inputId} className="lab-input" value={question} maxLength={MAX_QUESTION_CHARS}
          onChange={(e) => setQuestion(e.target.value)} placeholder="Ask the shop's documents…" />
        <button type="submit" className="btn btn-primary btn-small" disabled={!trimmed}>Ask</button>
        <label className="tryit-toggle">
          <input type="checkbox" checked={retrievalOn} onChange={(e) => onRetrieval(e.target.checked)} />
          Retrieval (RAG) {retrievalOn ? "on" : "off"}
        </label>
      </form>
      {/* The live region exists before the first run, so screen readers announce that run too. */}
      <div aria-live="polite">{run && <Results run={run} />}</div>
      <p className="muted small-text tryit-note">
        A toy pipeline you can check by hand: the "embedding" counts words (rarer words weigh more) and the "LLM" quotes its best source.
        Real RAG uses a neural embedder, which matches meaning rather than shared words, and a real LLM:
        try one in <a href={href({ page: "lab", lab: "playground" })}>Embeddings &amp; RAG</a>.
      </p>
    </div>
  );
}
