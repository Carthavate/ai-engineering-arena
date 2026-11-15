import { useId, useMemo, useState, type FormEvent } from "react";
import {
  BM25_DEFAULTS, bm25Index, bm25Rank, fuse, HYBRID_DOCS, HYBRID_QUERIES, RRF_DEFAULT_K, type Bm25Params,
} from "../../../logic/lab/hybrid";
import { href } from "../../../logic/route";
import { LoadNote } from "../useEmbed";
import { Bm25Panel } from "./Bm25Panel";
import { FusionPanel } from "./FusionPanel";
import { useVectorSearch, type VectorSearch } from "./useVectorSearch";
import "../blueprint.css";
import "./hybrid.css";

const MAX_QUERY_CHARS = 200;
/** Equal weights, as LangChain's EnsembleRetriever uses by default. */
const DEFAULT_BM25_WEIGHT = 0.5;
const INDEX = bm25Index(HYBRID_DOCS);

/** What the vector column shows until its ranking is ready. */
function VectorStatusNote({ search }: { readonly search: VectorSearch }) {
  if (search.status === "embedding") return <p className="hy-empty">Embedding the query…</p>;
  if (search.status === "failed") {
    return (
      <div className="hy-embed">
        <LoadNote load={search.load} />
        <button type="button" className="btn btn-ghost btn-small" onClick={search.retry}>Try again</button>
      </div>
    );
  }
  return (
    <div className="hy-embed">
      <button type="button" className="btn btn-primary btn-small" onClick={search.embedDocuments} disabled={search.load.busy}>Embed the documents</button>
      <span className="hy-dim">Runs a real embedding model in your browser (about 23 MB, downloaded once).</span>
      <LoadNote load={search.load} />
    </div>
  );
}

/** The Lab's hybrid search explorer: BM25 and vector search on the same query, then reciprocal rank fusion. */
export function HybridLab() {
  const [query, setQuery] = useState(HYBRID_QUERIES[0].text);
  const [draft, setDraft] = useState(HYBRID_QUERIES[0].text);
  const [params, setParams] = useState<Bm25Params>(BM25_DEFAULTS);
  const [k, setK] = useState(RRF_DEFAULT_K);
  const [weight, setWeight] = useState(DEFAULT_BM25_WEIGHT);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const vectorSearch = useVectorSearch(query);
  const inputId = useId();

  const bm25 = useMemo(() => bm25Rank(query, INDEX, params), [query, params]);
  const vector = vectorSearch.ranked;
  const fused = fuse([
    { name: "bm25", ranked: bm25, weight },
    ...(vector ? [{ name: "vector", ranked: vector, weight: 1 - weight }] : []),
  ], k);
  const preset = HYBRID_QUERIES.find((q) => q.text === query);

  const search = (q: string) => {
    const text = q.trim().slice(0, MAX_QUERY_CHARS);
    if (!text) return;
    setQuery(text);
    setDraft(text);
    setSelected(null);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    search(draft);
  };

  return (
    <div className="playground">
      <p className="banner info">
        Search the same snippets two ways, keyword (BM25) and meaning (vectors), and fuse the results with reciprocal rank fusion.
        Goes with lessons <a href={href({ page: "lesson", lesson: "rag-14" })}>#14</a>, <a href={href({ page: "lesson", lesson: "rag-15" })}>#15</a> and{" "}
        <a href={href({ page: "lesson", lesson: "rag-16" })}>#16</a>.
      </p>
      <section className="panel hybrid-lab blueprint" aria-labelledby="hybrid-title">
        <div className="panel-head">
          <h2 id="hybrid-title" className="panel-title">Hybrid search</h2>
          <span className="muted small-text">{HYBRID_DOCS.length} help snippets from the bike shop</span>
        </div>

        <form className="hy-search" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor={inputId}>Query</label>
          <input id={inputId} className="lab-input" value={draft} maxLength={MAX_QUERY_CHARS} onChange={(e) => setDraft(e.target.value)} placeholder="Search the help snippets…" />
          <button type="submit" className="btn btn-primary btn-small" disabled={!draft.trim()}>Search</button>
        </form>
        <div className="bp-chips" role="group" aria-label="Example queries">
          {HYBRID_QUERIES.map((q) => (
            <button key={q.text} type="button" aria-pressed={q.text === query} className={q.text === query ? "is-on" : ""} onClick={() => search(q.text)}>{q.text}</button>
          ))}
        </div>
        {preset && <p className="hy-notice"><b>Notice:</b> {preset.notice}</p>}

        <Bm25Panel ranked={bm25} index={INDEX} params={params} onParams={setParams} selected={selected} onSelect={setSelected} />
        <FusionPanel bm25={bm25} vector={vector} fused={fused} k={k} onK={setK} weight={weight} onWeight={setWeight}
          hovered={hovered} onHover={setHovered} vectorStatus={<VectorStatusNote search={vectorSearch} />} />
      </section>
    </div>
  );
}
