import { useCallback, useRef, useState } from "react";
import { useRte } from "../../../rte/RteContext";
import type { Vec } from "../../logic/lab/vectors";

export interface Load {
  readonly busy: boolean;
  readonly pct: number | null;
  readonly error: string | null;
}

const IDLE: Load = { busy: false, pct: null, error: null };
const FAILED = "Couldn't run the model. Check your connection (the first run downloads about 23 MB) and try again.";

/**
 * Run the in-browser embedding model (downloaded once, then cached) and track its progress.
 * `run` keeps its identity between renders, and `busy` stays on until the last of several overlapping calls ends.
 */
export function useEmbed() {
  const { embedder } = useRte();
  const [load, setLoad] = useState<Load>(IDLE);
  const inFlight = useRef(0);
  const run = useCallback(async (texts: string[]): Promise<Vec[] | null> => {
    inFlight.current += 1;
    setLoad({ busy: true, pct: null, error: null });
    try {
      return await embedder.embed(texts, (pct) => setLoad({ busy: true, pct, error: null }));
    } catch (err) {
      console.error("Embedding failed", err);
      setLoad({ busy: false, pct: null, error: FAILED });
      return null;
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0) setLoad((l) => (l.error ? { ...l, busy: false } : IDLE));
    }
  }, [embedder]);
  return { load, run };
}

/** Download progress, "running", or the error; nothing while idle. */
export function LoadNote({ load }: { readonly load: Load }) {
  if (load.error) return <p className="form-error">{load.error}</p>;
  if (!load.busy) return null;
  return (
    <div className="model-load" role="status">
      <span>{load.pct === null ? "Running the model…" : `Downloading the model (first time only)… ${load.pct}%`}</span>
      {load.pct !== null && <span className="load-bar"><i style={{ width: `${load.pct}%` }} /></span>}
    </div>
  );
}
