// The built-in knowledge: our own notes on each RAG lecture (original summaries, not transcripts).
import { findRoadmapItem } from "../activity";
import { chunkMarkdown, parseFrontMatter, type Chunk, type PersonalNote } from "./documents";

const NOTES: Record<string, string> = import.meta.glob("./notes/*.md", { query: "?raw", import: "default", eager: true });

/** Every lecture note, chunked by section. */
export const LECTURE_CHUNKS: readonly Chunk[] = Object.keys(NOTES)
  .sort()
  .flatMap((path) => {
    const { meta, body } = parseFrontMatter(NOTES[path]);
    const item = findRoadmapItem(meta.item ?? "");
    if (!item) throw new Error(`Lecture note ${path} points at unknown roadmap item "${meta.item}"`);
    return chunkMarkdown({ kind: "lecture", sourceId: item.id, title: item.title, url: item.url }, body);
  });

/** A player's own notes, chunked the same way (Markdown headings first, then recursive splitting). */
export function noteChunks(notes: readonly PersonalNote[]): Chunk[] {
  return notes.flatMap((n) => chunkMarkdown({ kind: "note", sourceId: n.id, title: n.title }, n.text));
}
