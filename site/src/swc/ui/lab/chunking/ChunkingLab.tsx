import { useState } from "react";
import {
  answerCheck, CHUNK_QUESTIONS, chunkStats, fixedChunks, recursiveSplit, SAMPLE_DOC, SEPARATOR_NAMES, semanticChunks, sentencesOf,
  type Chunk, type SemanticResult,
} from "../../../logic/lab/chunking";
import type { Vec } from "../../../logic/lab/vectors";
import { href } from "../../../logic/route";
import { LoadNote, useEmbed } from "../useEmbed";
import { BreakpointChart } from "./BreakpointChart";
import { ChunkedText } from "./ChunkedText";
import { AnswerPanel, ChunkInspector } from "./ChunkPanels";
import "../blueprint.css";
import "./chunking.css";

type Strategy = "fixed" | "recursive" | "semantic";

const STRATEGIES: readonly { readonly id: Strategy; readonly label: string; readonly note: string; readonly lesson: string }[] = [
  { id: "fixed", label: "Fixed size", lesson: "rag-3",
    note: "Cut every N characters, wherever that lands. Fast and simple, but cuts go straight through sentences; overlap repeats the edge of each chunk in the next so a cut sentence still appears whole somewhere." },
  { id: "recursive", label: "Recursive", lesson: "rag-9",
    note: "Try the biggest natural break first (paragraph), and only fall back to lines, sentences, then words when a piece is still too long. Small pieces are merged back up to the size limit." },
  { id: "semantic", label: "Semantic", lesson: "rag-10",
    note: "Embed every sentence and cut where the meaning jumps: where the distance to the next sentence is above a percentile of all the distances. Chunks follow topics, not character counts." },
];

/** Slider ranges, in characters. 60 is about one short sentence; 600 holds a whole paragraph of the sample. */
const SIZE = { min: 60, max: 600, step: 10, start: 200 } as const;
const MAX_OVERLAP = 200;
const PERCENTILE = { min: 50, max: 99, start: 80 } as const;
const MAX_TEXT_CHARS = 3000;
/** The question the page opens on: its answer gets cut by the default fixed-size chunks. */
const START_QUESTION = 1;

interface Embedded {
  readonly text: string;
  readonly vectors: readonly Vec[];
}

/** The Lab's chunking explorer: cut a document three ways and see what each cut breaks. */
export function ChunkingLab() {
  const [strategy, setStrategy] = useState<Strategy>("fixed");
  const [size, setSize] = useState<number>(SIZE.start);
  const [overlap, setOverlap] = useState(0);
  const [pct, setPct] = useState<number>(PERCENTILE.start);
  const [text, setText] = useState(SAMPLE_DOC);
  const [draft, setDraft] = useState<string | null>(null);
  const [question, setQuestion] = useState(START_QUESTION);
  const [focused, setFocused] = useState<number | null>(null);
  const [embedded, setEmbedded] = useState<Embedded | null>(null);
  const { load, run } = useEmbed();

  const maxOverlap = Math.min(size - SIZE.step, MAX_OVERLAP);
  const usedOverlap = Math.min(overlap, maxOverlap);
  const recursive = strategy === "recursive" ? recursiveSplit(text, size, usedOverlap) : null;
  const semantic: SemanticResult | null = strategy === "semantic" && embedded?.text === text ? semanticChunks(text, embedded.vectors, pct) : null;
  const chunks: readonly Chunk[] = strategy === "fixed" ? fixedChunks(text, size, usedOverlap) : recursive?.chunks ?? semantic?.chunks ?? [];
  const stats = chunkStats(text, chunks);
  const check = answerCheck(text, chunks, CHUNK_QUESTIONS[question]);
  const answerAt = text.indexOf(CHUNK_QUESTIONS[question].answer);
  const answer = answerAt < 0 ? null : { start: answerAt, end: answerAt + CHUNK_QUESTIONS[question].answer.length };
  const shown = focused !== null && focused < chunks.length ? focused : check.top;
  const info = STRATEGIES.find((s) => s.id === strategy)!;

  const embedSentences = async () => {
    const vectors = await run(sentencesOf(text).map((s) => text.slice(s.start, s.end)));
    if (vectors) setEmbedded({ text, vectors });
  };
  const useDraft = () => {
    if (draft === null || !draft.trim()) return;
    // Pasted text may carry Windows line breaks; the splitters look for "\n".
    setText(draft.replace(/\r\n?/g, "\n").slice(0, MAX_TEXT_CHARS));
    setDraft(null);
    setFocused(null);
  };

  return (
    <div className="playground">
      <p className="banner info">
        Cut the same document three ways and watch what each cut breaks, then check whether the chunk retrieval returns still holds the answer.
        Goes with lessons <a href={href({ page: "lesson", lesson: "rag-3" })}>#3</a>, <a href={href({ page: "lesson", lesson: "rag-8" })}>#8</a>,{" "}
        <a href={href({ page: "lesson", lesson: "rag-9" })}>#9</a> and <a href={href({ page: "lesson", lesson: "rag-10" })}>#10</a>.
      </p>
      <section className="panel chunk-lab blueprint" aria-labelledby="chunk-title">
        <div className="panel-head">
          <h2 id="chunk-title" className="panel-title">Chunking</h2>
          <span className="muted small-text">Same text, different cuts</span>
        </div>

        <div className="ck-controls">
          <div className="ck-seg" role="group" aria-label="Strategy">
            {STRATEGIES.map((s) => (
              <button key={s.id} type="button" aria-pressed={s.id === strategy} className={s.id === strategy ? "is-on" : ""}
                onClick={() => { setStrategy(s.id); setFocused(null); }}>{s.label}</button>
            ))}
          </div>
          {strategy !== "semantic" ? (
            <>
              <label className="bp-slider">Chunk size <b>{size}</b>
                <input type="range" min={SIZE.min} max={SIZE.max} step={SIZE.step} value={size} onChange={(e) => { setSize(Number(e.target.value)); setFocused(null); }} />
              </label>
              <label className="bp-slider">Overlap <b>{usedOverlap}</b>
                <input type="range" min={0} max={maxOverlap} step={5} value={usedOverlap} onChange={(e) => { setOverlap(Number(e.target.value)); setFocused(null); }} />
              </label>
            </>
          ) : (
            <label className="bp-slider">Breakpoint percentile <b>{pct}</b>
              <input type="range" min={PERCENTILE.min} max={PERCENTILE.max} value={pct} onChange={(e) => { setPct(Number(e.target.value)); setFocused(null); }} disabled={!semantic} />
            </label>
          )}
        </div>
        <p className="ck-note">
          {info.note} <a href={href({ page: "lesson", lesson: info.lesson })}>Lesson #{info.lesson.split("-")[1]}</a>
        </p>

        {strategy === "semantic" && !semantic && (
          <div className="ck-embed">
            <button type="button" className="btn btn-primary btn-small" onClick={() => void embedSentences()} disabled={load.busy}>Embed the sentences</button>
            <span className="peek-dim">Runs a real embedding model in your browser (downloads about 23 MB once, then it's cached).</span>
            <LoadNote load={load} />
          </div>
        )}

        {chunks.length > 0 && (
          <p className="ck-stats">
            <span><b>{stats.count}</b> chunks</span>
            <span>about <b>{stats.averageLength}</b> characters each</span>
            <span className={stats.brokenCuts ? "ck-bad" : "ck-good"}><b>{stats.brokenCuts}</b> of {stats.innerEdges} cuts break a sentence</span>
            {recursive && <span>split at: {recursive.used.length ? recursive.used.map((s) => SEPARATOR_NAMES[s]).join(" → ") : "nothing (it fits)"}</span>}
          </p>
        )}

        <div className="ck-sheet">
          {draft === null ? (
            <ChunkedText text={text} chunks={chunks} focused={shown} retrieved={check.top} answer={answer} onFocus={setFocused} />
          ) : (
            <textarea className="ck-draft" value={draft} maxLength={MAX_TEXT_CHARS} onChange={(e) => setDraft(e.target.value)} aria-label="Your text" />
          )}
          <div className="ck-sheet-tools">
            {draft === null ? (
              <button type="button" className="ck-tool" onClick={() => setDraft(text)}>Edit the text</button>
            ) : (
              <>
                <button type="button" className="ck-tool" onClick={useDraft} disabled={!draft.trim()}>Use this text</button>
                <button type="button" className="ck-tool" onClick={() => setDraft(SAMPLE_DOC)}>Back to the sample</button>
                <button type="button" className="ck-tool" onClick={() => setDraft(null)}>Cancel</button>
              </>
            )}
          </div>
        </div>

        {semantic && <BreakpointChart distances={semantic.distances} threshold={semantic.threshold} percentile={pct} breaks={semantic.breaks} />}

        {chunks.length > 0 && (
          <div className="ck-below">
            {shown !== null && <ChunkInspector text={text} chunks={chunks} index={shown} onIndex={setFocused} />}
            <AnswerPanel question={question} onQuestion={(i) => { setQuestion(i); setFocused(null); }} check={check} />
          </div>
        )}
      </section>
    </div>
  );
}
