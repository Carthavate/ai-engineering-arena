import type { ReactNode } from "react";
import type { Fused, Ranked } from "../../../logic/lab/hybrid";
import { DocChip } from "./DocChip";

/** RRF's k slider range. 1 makes rank 1 dominate; 100 flattens the ranks almost to a vote count. */
const K_RANGE = { min: 1, max: 100 } as const;

interface Props {
  readonly bm25: readonly Ranked[];
  readonly vector: readonly Ranked[] | null;
  readonly fused: readonly Fused[];
  readonly k: number;
  readonly onK: (k: number) => void;
  /** BM25's weight; vector search gets 1 − weight. */
  readonly weight: number;
  readonly onWeight: (w: number) => void;
  readonly hovered: string | null;
  readonly onHover: (id: string | null) => void;
  /** Shown in the vector column until its ranking is ready. */
  readonly vectorStatus: ReactNode;
}

function Column({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="fu-col">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

function RankList({ ranked, hovered, onHover, detail }: {
  readonly ranked: readonly Ranked[];
  readonly hovered: string | null;
  readonly onHover: (id: string | null) => void;
  readonly detail: (r: Ranked) => ReactNode;
}) {
  if (ranked.length === 0) return <p className="hy-empty">Nothing returned.</p>;
  return (
    <ol className="hy-list">
      {ranked.map((r) => (
        <li key={r.id} className={`fu-item${hovered === r.id ? " is-hovered" : ""}`}
          onMouseEnter={() => onHover(r.id)} onMouseLeave={() => onHover(null)}>
          <span className="hy-rank">{r.rank}</span>
          <DocChip id={r.id} />
          <span className="fu-detail">{detail(r)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Reciprocal rank fusion: two ranked lists in, one out, using only the ranks. */
export function FusionPanel({ bm25, vector, fused, k, onK, weight, onWeight, hovered, onHover, vectorStatus }: Props) {
  const parts = (f: Ranked) => {
    const p = (fused.find((x) => x.id === f.id)?.parts ?? []).filter((x) => x.contribution > 0);
    return <>{p.map((x) => `${x.list === "bm25" ? weight.toFixed(1) : (1 - weight).toFixed(1)}/(${k}+${x.rank})`).join(" + ")} = <b>{f.score.toFixed(4)}</b></>;
  };
  return (
    <section className="hy-card" aria-labelledby="fu-title">
      <div className="hy-card-head">
        <h3 id="fu-title">2 · Fuse the two lists (RRF)</h3>
        <span className="hy-dim">score = Σ weight / (k + rank)</span>
      </div>
      <div className="fu-tune">
        <label className="bp-slider">k <b>{k}</b>
          <input type="range" min={K_RANGE.min} max={K_RANGE.max} value={k} onChange={(e) => onK(Number(e.target.value))} />
        </label>
        <label className="bp-slider">Weight: BM25 <b>{weight.toFixed(1)}</b> · vector <b>{(1 - weight).toFixed(1)}</b>
          <input type="range" min={0} max={1} step={0.1} value={weight} onChange={(e) => onWeight(Number(e.target.value))} />
        </label>
      </div>
      <div className="fu-cols">
        <Column title="BM25 (keywords)">
          <RankList ranked={bm25} hovered={hovered} onHover={onHover} detail={(r) => r.score.toFixed(2)} />
        </Column>
        <Column title="Vector (meaning)">
          {vector ? <RankList ranked={vector} hovered={hovered} onHover={onHover} detail={(r) => r.score.toFixed(2)} /> : vectorStatus}
        </Column>
        <Column title={vector ? "Fused (RRF)" : "Fused (BM25 only, until vectors are ready)"}>
          <RankList ranked={fused} hovered={hovered} onHover={onHover} detail={parts} />
        </Column>
      </div>
      <p className="hy-dim">
        Hover a document to find it in every list. RRF ignores the raw scores (BM25 points and cosine similarities aren't on the same scale) and uses only ranks:
        a document near the top of both lists beats one at the top of just one.
      </p>
    </section>
  );
}
