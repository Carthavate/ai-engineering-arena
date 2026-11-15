import { Fragment } from "react";
import { boundaryIsClean, segmentsOf, type Chunk } from "../../../logic/lab/chunking";

/** Chunk colours cycle through this many tints, so neighbours always differ. */
const TINTS = 4;

interface Props {
  readonly text: string;
  readonly chunks: readonly Chunk[];
  /** The chunk shown in the inspector, and the one retrieval returns. */
  readonly focused: number | null;
  readonly retrieved: number | null;
  /** Where the current question's answer sits in the text, if it does. */
  readonly answer: Chunk | null;
  readonly onFocus: (chunk: number) => void;
}

/** The document with every chunk tinted, overlaps striped, and a marker at each cut (coral when it breaks a sentence). */
export function ChunkedText({ text, chunks, focused, retrieved, answer, onFocus }: Props) {
  const segments = segmentsOf(text.length, chunks, answer ? [answer.start, answer.end] : []);
  const starts = new Set(chunks.slice(1).map((c) => c.start));
  const ends = new Set(chunks.slice(0, -1).map((c) => c.end));

  return (
    <div className="ck-doc" role="group" aria-label="The document, coloured by chunk">
      {segments.map((s) => {
        const [first] = s.chunks;
        // Blank lines inside a chunk get no outline: it would draw an empty box.
        const ink = /\S/.test(text.slice(s.start, s.end));
        const cls = [
          "ck-span",
          first === undefined ? "ck-span-gap" : `ck-tint-${first % TINTS}`,
          s.chunks.length > 1 ? "ck-span-overlap" : "",
          ink && s.chunks.includes(focused ?? -1) ? "is-focused" : "",
          ink && s.chunks.includes(retrieved ?? -1) ? "is-retrieved" : "",
          answer && s.start >= answer.start && s.end <= answer.end ? "is-answer" : "",
        ].filter(Boolean).join(" ");
        // A cut at this position: where a chunk starts or (another) ends.
        const cutHere = s.start > 0 && (starts.has(s.start) || ends.has(s.start));
        return (
          <Fragment key={s.start}>
            {cutHere && <span className={`ck-cut ${boundaryIsClean(text, s.start) ? "ck-cut-clean" : "ck-cut-broken"}`} aria-hidden="true" />}
            <span className={cls} onMouseEnter={() => first !== undefined && onFocus(first)}>{text.slice(s.start, s.end)}</span>
          </Fragment>
        );
      })}
    </div>
  );
}
