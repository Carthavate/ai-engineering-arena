/** Chart size and margins, in SVG pixels. */
const W = 720;
const H = 170;
const PAD = { left: 44, right: 16, top: 16, bottom: 30 };

interface Props {
  /** Cosine distance between each sentence and the next. */
  readonly distances: readonly number[];
  readonly threshold: number;
  readonly percentile: number;
  readonly breaks: readonly number[];
}

/** Semantic chunking at a glance: one bar per gap between sentences; bars above the threshold become cuts. */
export function BreakpointChart({ distances, threshold, percentile, breaks }: Props) {
  if (distances.length === 0) return null;
  const max = Math.max(...distances, threshold, 0.01);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / distances.length;
  const y = (d: number) => PAD.top + plotH * (1 - d / max);
  const cut = new Set(breaks);

  return (
    <figure className="bp-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Distance between neighbouring sentences. ${breaks.length} gaps are above the ${percentile}th percentile and become cuts.`}>
        <line className="bp-axis" x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} />
        <text className="bp-tick" x={PAD.left - 6} y={y(max) + 4} textAnchor="end">{max.toFixed(2)}</text>
        <text className="bp-tick" x={PAD.left - 6} y={PAD.top + plotH + 4} textAnchor="end">0</text>
        {distances.map((d, i) => (
          <g key={i} className={cut.has(i) ? "bp-bar is-cut" : "bp-bar"}>
            <rect x={PAD.left + i * slot + slot * 0.2} y={y(d)} width={slot * 0.6} height={PAD.top + plotH - y(d)} rx={2} />
            <text className="bp-tick" x={PAD.left + i * slot + slot / 2} y={H - 10} textAnchor="middle">{i + 1}</text>
          </g>
        ))}
        <line className="bp-threshold" x1={PAD.left} y1={y(threshold)} x2={W - PAD.right} y2={y(threshold)} />
        <text className="bp-label" x={PAD.left + 6} y={y(threshold) - 6}>{percentile}th percentile = {threshold.toFixed(2)}</text>
      </svg>
      <figcaption className="peek-dim">Bar n is the distance between sentence n and the next one. Taller bars mean the topic changes there.</figcaption>
    </figure>
  );
}
