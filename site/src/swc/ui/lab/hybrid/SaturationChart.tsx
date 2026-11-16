import { saturation } from "../../../logic/lab/hybrid";

/** Chart size and margins, in SVG pixels. */
const W = 340;
const H = 190;
const PAD = { left: 34, right: 12, top: 14, bottom: 34 };
/** Repeats shown on the x axis. */
const MAX_TF = 10;
/** The long document in the comparison is this many times the average length. */
const LONG_DOC = 2;
/** The k1 slider's top; the chart's y axis runs to the highest ceiling it allows, k1 + 1. */
export const K1_MAX = 3;

interface Props {
  readonly k1: number;
  readonly b: number;
}

/** How much a word counts as it repeats (before idf), for an average-length document and a long one. */
export function SaturationChart({ k1, b }: Props) {
  const yMax = K1_MAX + 1;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (tf: number) => PAD.left + (tf / MAX_TF) * plotW;
  const y = (v: number) => PAD.top + plotH * (1 - v / yMax);
  const curve = (lengthRatio: number) =>
    Array.from({ length: MAX_TF + 1 }, (_, tf) => `${tf ? "L" : "M"}${x(tf).toFixed(1)},${y(saturation(tf, k1, b, lengthRatio, 1)).toFixed(1)}`).join(" ");

  return (
    <figure className="sat-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`With k1 ${k1} and b ${b}, one occurrence counts ${saturation(1, k1, b, 1, 1).toFixed(2)} and ten count ${saturation(10, k1, b, 1, 1).toFixed(2)}.`}>
        <line className="sat-axis" x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} />
        <line className="sat-axis" x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} />
        <line className="sat-cap" x1={PAD.left} y1={y(k1 + 1)} x2={W - PAD.right} y2={y(k1 + 1)} />
        <text className="sat-tick" x={W - PAD.right} y={y(k1 + 1) - 5} textAnchor="end">ceiling k1 + 1 = {(k1 + 1).toFixed(1)}</text>
        {Array.from({ length: yMax + 1 }, (_, v) => v).map((v) => <text key={v} className="sat-tick" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">{v}</text>)}
        {[0, 2, 4, 6, 8, 10].map((tf) => <text key={tf} className="sat-tick" x={x(tf)} y={PAD.top + plotH + 14} textAnchor="middle">{tf}</text>)}
        <text className="sat-tick" x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle">times the word appears</text>
        <path className="sat-line" d={curve(1)} />
        <path className="sat-line sat-long" d={curve(LONG_DOC)} />
      </svg>
      <figcaption className="sat-legend">
        <span><i className="sat-key" /> average-length document</span>
        <span><i className="sat-key sat-key-long" /> document {LONG_DOC}× as long</span>
      </figcaption>
    </figure>
  );
}
