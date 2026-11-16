// The flat RAG drawing: where each part stands, how the wires run, and what each part looks like.
// Coordinates are SVG pixels in a 1040 × 470 sheet. Each part is drawn around its centre.
import type { ReactNode } from "react";
import type { EdgeId, PartId } from "../../../logic/lab/ragTour";

export const SHEET = { w: 1040, h: 470 } as const;

export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** Centre of each part. The indexing pipeline runs along the top lane, the query pipeline along the bottom one.
    The embedding model belongs to indexing; at query time the question climbs up to the same model. */
export const SPOTS: Record<PartId, Spot> = {
  docs: { x: 100, y: 120 },
  chunker: { x: 285, y: 120 },
  embedder: { x: 480, y: 120 },
  vectordb: { x: 680, y: 120 },
  question: { x: 100, y: 345 },
  prompt: { x: 680, y: 345 },
  llm: { x: 832, y: 345 },
  answer: { x: 960, y: 345 },
};

/** Distance from a part's centre down to the baseline of its name. */
export const LABEL_DY = 56;

export interface Lane {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const LANES: readonly Lane[] = [
  { label: "INDEXING TIME · RUNS ONCE", x: 24, y: 30, w: 740, h: 180 },
  { label: "QUERY TIME · EVERY QUESTION", x: 24, y: 262, w: 1000, h: 186 },
];

/** A note on the sheet explaining a wire, right-aligned to x (here, just left of the wire it explains). */
export const NOTES: readonly { readonly text: string; readonly x: number; readonly y: number }[] = [
  { text: "SAME MODEL EMBEDS THE QUESTION ↑", x: 552, y: 240 },
];

type Route = readonly (readonly [number, number])[];

/** Wires with right-angle bends, from the source part's edge to the target part's edge. */
export const ROUTES: Record<EdgeId, Route> = {
  "docs-chunker": [[148, 120], [232, 120]],
  "chunker-embedder": [[336, 120], [430, 120]],
  "embedder-vectordb": [[530, 108], [638, 108]],
  // Climbs right of the embedder's name, then enters its right side below the wire to the database.
  "question-embedder": [[148, 333], [562, 333], [562, 142], [532, 142]],
  "vectordb-prompt": [[680, 162], [680, 306]],
  "question-prompt": [[148, 356], [636, 356]],
  "prompt-llm": [[722, 345], [780, 345]],
  "llm-answer": [[884, 345], [914, 345]],
  "question-llm": [[60, 378], [60, 432], [860, 432], [860, 384]],
};

export function routePath(route: Route): string {
  return route.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
}

function Lines({ x1, x2, ys, className = "ink-line" }: { readonly x1: number; readonly x2: number; readonly ys: readonly number[]; readonly className?: string }) {
  return <>{ys.map((y) => <line key={y} className={className} x1={x1} y1={y} x2={x2} y2={y} />)}</>;
}

function Docs() {
  return (
    <>
      <rect className="fill" x={-26} y={-40} width={58} height={68} rx={3} />
      <rect className="fill" x={-32} y={-34} width={58} height={68} rx={3} />
      <path className="fill" d="M-40,-28 H6 L18,-16 V40 H-40 Z" />
      <path className="ink-line" d="M6,-28 V-16 H18" />
      <Lines x1={-32} x2={10} ys={[-10, 0, 10, 20]} />
    </>
  );
}

function Chunker() {
  return (
    <>
      {[-32, -8, 16].map((y, i) => (
        <g key={y} transform={`translate(${i === 1 ? 6 : 0} 0)`}>
          <rect className="fill" x={-44} y={y} width={84} height={18} rx={3} />
          <line className="ink-line" x1={-36} y1={y + 9} x2={i === 2 ? 10 : 28} y2={y + 9} />
        </g>
      ))}
      <Lines x1={-54} x2={54} ys={[-11, 13]} className="cut-line" />
    </>
  );
}

function Embedder() {
  const bars = [14, 26, 8, 20, 30, 12];
  return (
    <>
      {[-30, -14, 2, 18].map((x) => <rect key={x} className="pin" x={x} y={-42} width={8} height={8} />)}
      {[-30, -14, 2, 18].map((x) => <rect key={-x} className="pin" x={x} y={34} width={8} height={8} />)}
      <rect className="fill" x={-48} y={-34} width={96} height={68} rx={8} />
      <text className="ink-text" x={-26} y={6} textAnchor="middle">f(x)</text>
      <path className="ink-line" d="M-8,0 H4 M0,-4 L4,0 L0,4" />
      {bars.map((h, i) => <rect key={i} className="bar" x={10 + i * 5.5} y={14 - h} width={4} height={h} />)}
    </>
  );
}

function VectorDb() {
  return (
    <>
      <path className="fill" d="M-40,-28 V30 A40,11 0 0 0 40,30 V-28" />
      <path className="ink-line" d="M-40,-8 A40,11 0 0 0 40,-8 M-40,11 A40,11 0 0 0 40,11" />
      <ellipse className="fill top" cx={0} cy={-28} rx={40} ry={11} />
    </>
  );
}

function Bubble({ tail, children }: { readonly tail: "left" | "right"; readonly children: ReactNode }) {
  const d = tail === "left"
    ? "M-34,-32 H34 Q44,-32 44,-22 V14 Q44,24 34,24 H-12 L-28,38 L-24,24 H-34 Q-44,24 -44,14 V-22 Q-44,-32 -34,-32 Z"
    : "M-34,-32 H34 Q44,-32 44,-22 V14 Q44,24 34,24 H24 L28,38 L12,24 H-34 Q-44,24 -44,14 V-22 Q-44,-32 -34,-32 Z";
  return (
    <>
      <path className="fill" d={d} />
      {children}
    </>
  );
}

function Prompt() {
  return (
    <>
      <rect className="fill" x={-40} y={-38} width={80} height={76} rx={4} />
      <rect className="band" x={-40} y={-38} width={80} height={16} rx={4} />
      <text className="band-text" x={0} y={-26} textAnchor="middle">PROMPT</text>
      <Lines x1={-30} x2={30} ys={[-10, 0]} className="src-line" />
      <Lines x1={-30} x2={20} ys={[12, 22]} />
    </>
  );
}

function Llm() {
  const pins = [-24, -8, 8, 24];
  return (
    <>
      {pins.map((p) => <rect key={`t${p}`} className="pin" x={p - 3} y={-42} width={6} height={8} />)}
      {pins.map((p) => <rect key={`b${p}`} className="pin" x={p - 3} y={34} width={6} height={8} />)}
      {pins.map((p) => <rect key={`l${p}`} className="pin" x={-50} y={p - 3} width={8} height={6} />)}
      {pins.map((p) => <rect key={`r${p}`} className="pin" x={42} y={p - 3} width={8} height={6} />)}
      <rect className="fill" x={-42} y={-34} width={84} height={68} rx={8} />
      <rect className="fill top" x={-26} y={-20} width={52} height={40} rx={5} />
      <text className="chip-text" x={0} y={8} textAnchor="middle">LLM</text>
    </>
  );
}

/** The drawing of one part. The answer bubble shows a tick for a grounded answer and a cross for a guess. */
export function PartDrawing({ id, answerOk }: { readonly id: PartId; readonly answerOk: boolean }) {
  switch (id) {
    case "docs": return <Docs />;
    case "chunker": return <Chunker />;
    case "embedder": return <Embedder />;
    case "vectordb": return <VectorDb />;
    case "question": return <Bubble tail="left"><text className="glyph" x={0} y={8} textAnchor="middle">?</text></Bubble>;
    case "prompt": return <Prompt />;
    case "llm": return <Llm />;
    case "answer": return (
      <Bubble tail="right">
        <text className={`glyph ${answerOk ? "glyph-ok" : "glyph-bad"}`} x={0} y={8} textAnchor="middle">{answerOk ? "✓" : "✗"}</text>
      </Bubble>
    );
  }
}
