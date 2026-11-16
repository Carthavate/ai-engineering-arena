import { useCallback, useEffect, useRef, useState } from "react";
import { HYBRID_DOCS, vectorRank, type Ranked } from "../../../logic/lab/hybrid";
import type { Vec } from "../../../logic/lab/vectors";
import { useEmbed, type Load } from "../useEmbed";

const DOC_IDS = HYBRID_DOCS.map((d) => d.id);

/**
 * needs-docs  the documents haven't been embedded yet
 * embedding   the current query's vector is on its way
 * failed      embedding the current query failed (retry is offered)
 * ready       the vector ranking is available
 */
export type VectorStatus = "needs-docs" | "embedding" | "failed" | "ready";

export interface VectorSearch {
  readonly status: VectorStatus;
  readonly ranked: readonly Ranked[] | null;
  readonly load: Load;
  readonly embedDocuments: () => void;
  readonly retry: () => void;
}

/**
 * Vector search for the hybrid explorer. Documents are embedded once, on request; each query's vector is cached
 * under its own text, so answers that arrive out of order can't overwrite a newer query, and the current query is
 * embedded whenever its vector is missing.
 */
export function useVectorSearch(query: string): VectorSearch {
  const { load, run } = useEmbed();
  const [docVecs, setDocVecs] = useState<readonly Vec[] | null>(null);
  const [queryVecs, setQueryVecs] = useState<ReadonlyMap<string, Vec>>(new Map());
  const [failed, setFailed] = useState<string | null>(null);
  const pending = useRef(new Set<string>());

  const embedQuery = useCallback(async (q: string) => {
    pending.current.add(q);
    const vectors = await run([q]);
    pending.current.delete(q);
    if (!vectors) {
      setFailed(q);
      return;
    }
    setQueryVecs((m) => new Map(m).set(q, vectors[0]));
  }, [run]);

  useEffect(() => {
    if (!docVecs || queryVecs.has(query) || failed === query || pending.current.has(query)) return;
    void embedQuery(query);
  }, [docVecs, query, queryVecs, failed, embedQuery]);

  const embedDocuments = () => {
    void run(HYBRID_DOCS.map((d) => d.text)).then((vectors) => vectors && setDocVecs(vectors));
  };

  const queryVec = queryVecs.get(query);
  const ranked = docVecs && queryVec ? vectorRank(queryVec, docVecs, DOC_IDS) : null;
  const status: VectorStatus = !docVecs ? "needs-docs" : ranked ? "ready" : failed === query ? "failed" : "embedding";
  return { status, ranked, load, embedDocuments, retry: () => setFailed(null) };
}
