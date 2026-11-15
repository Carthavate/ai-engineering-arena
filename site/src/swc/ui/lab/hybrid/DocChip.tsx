import { HYBRID_DOCS } from "../../../logic/lab/hybrid";

/** Hue step between documents, so each of the 12 snippets gets its own colour in every list. */
const HUE_STEP = 30;

/** A document's title on its own colour, the same in the BM25, vector and fused lists. */
export function DocChip({ id }: { readonly id: string }) {
  const i = HYBRID_DOCS.findIndex((d) => d.id === id);
  const title = HYBRID_DOCS[i]?.title ?? id;
  return <span className="hy-chip" style={{ ["--hue" as string]: `${i * HUE_STEP}` }}>{title}</span>;
}
