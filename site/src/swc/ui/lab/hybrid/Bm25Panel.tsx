import { HYBRID_DOCS, type Bm25Index, type Bm25Params, type Bm25Ranked } from "../../../logic/lab/hybrid";
import { DocChip } from "./DocChip";
import { K1_MAX, SaturationChart } from "./SaturationChart";

interface Props {
  readonly ranked: readonly Bm25Ranked[];
  readonly index: Bm25Index;
  readonly params: Bm25Params;
  readonly onParams: (p: Bm25Params) => void;
  /** The document whose score is broken down. */
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
}

function lengthNote(length: number, avg: number, b: number): string {
  if (b === 0) return "but b is 0, so length doesn't change the points.";
  return length > avg ? "so b lowers its points a little." : length < avg ? "so b raises its points a little." : "so b leaves its points as they are.";
}

function Breakdown({ doc, index, b }: { readonly doc: Bm25Ranked; readonly index: Bm25Index; readonly b: number }) {
  const text = HYBRID_DOCS.find((d) => d.id === doc.id)?.text ?? "";
  const length = index.docs.find((d) => d.id === doc.id)?.length ?? 0;
  return (
    <div className="bm-breakdown">
      <p className="hy-quote">“{text}”</p>
      <table className="bm-table">
        <thead>
          <tr><th scope="col">Word</th><th scope="col">Times here</th><th scope="col">In docs</th><th scope="col">Rarity (idf)</th><th scope="col">Points</th></tr>
        </thead>
        <tbody>
          {doc.terms.map((t) => (
            <tr key={t.term}>
              <th scope="row"><code>{t.term}</code></th>
              <td>{t.tf}</td>
              <td>{t.df} of {index.n}</td>
              <td>{t.idf.toFixed(2)}</td>
              <td><b>{t.contribution.toFixed(2)}</b></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th scope="row" colSpan={4}>BM25 score</th><td><b>{doc.score.toFixed(2)}</b></td></tr>
        </tfoot>
      </table>
      <p className="hy-dim">
        Points = rarity × saturation. This snippet has {length} words against an average of {index.avgLength.toFixed(1)}, {lengthNote(length, index.avgLength, b)}
      </p>
    </div>
  );
}

/** Keyword search: which documents BM25 ranks, why each scores what it does, and how k1 and b shape the score. */
export function Bm25Panel({ ranked, index, params, onParams, selected, onSelect }: Props) {
  const shown = ranked.find((r) => r.id === selected) ?? ranked[0];
  const max = ranked[0]?.score ?? 1;
  return (
    <section className="hy-card" aria-labelledby="bm-title">
      <div className="hy-card-head">
        <h3 id="bm-title">1 · Keyword search (BM25)</h3>
        <span className="hy-dim">Exact words, weighted by how rare they are</span>
      </div>
      <div className="bm-grid">
        <div>
          {ranked.length === 0 ? (
            <p className="hy-empty">No document contains any word of the query, so BM25 returns nothing.</p>
          ) : (
            <ol className="hy-list">
              {ranked.map((r) => (
                <li key={r.id}>
                  <button type="button" className={`hy-row${r.id === shown?.id ? " is-on" : ""}`} aria-pressed={r.id === shown?.id} onClick={() => onSelect(r.id)}>
                    <span className="hy-rank">{r.rank}</span>
                    <DocChip id={r.id} />
                    <span className="hy-bar"><i style={{ width: `${(r.score / max) * 100}%` }} /></span>
                    <span className="hy-score">{r.score.toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {shown && <Breakdown doc={shown} index={index} b={params.b} />}
        </div>
        <div className="bm-tune">
          <label className="bp-slider">k1 · how fast repeats stop counting <b>{params.k1.toFixed(1)}</b>
            <input type="range" min={0} max={K1_MAX} step={0.1} value={params.k1} onChange={(e) => onParams({ ...params, k1: Number(e.target.value) })} />
          </label>
          <label className="bp-slider">b · how much document length counts <b>{params.b.toFixed(2)}</b>
            <input type="range" min={0} max={1} step={0.05} value={params.b} onChange={(e) => onParams({ ...params, b: Number(e.target.value) })} />
          </label>
          <SaturationChart k1={params.k1} b={params.b} />
        </div>
      </div>
    </section>
  );
}
