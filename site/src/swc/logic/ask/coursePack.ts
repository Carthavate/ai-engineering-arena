// The built-in knowledge: our own notes on each RAG lecture (original summaries, not transcripts).
import { findRoadmapItem } from "../activity";
import type { RoadmapItem } from "../roadmap";
import { chunkMarkdown, parseFrontMatter, sections, type Chunk, type PersonalNote, type Section } from "./documents";

const NOTES: Record<string, string> = import.meta.glob("./notes/*.md", { query: "?raw", import: "default", eager: true });

const LECTURES: ReadonlyArray<{ readonly item: RoadmapItem; readonly body: string }> = Object.keys(NOTES)
  .sort()
  .map((path) => {
    const { meta, body } = parseFrontMatter(NOTES[path]);
    const item = findRoadmapItem(meta.item ?? "");
    if (!item) throw new Error(`Lecture note ${path} points at unknown roadmap item "${meta.item}"`);
    return { item, body };
  });

/** Every lecture note, chunked by section. */
export const LECTURE_CHUNKS: readonly Chunk[] = LECTURES.flatMap(({ item, body }) =>
  chunkMarkdown({ kind: "lecture", sourceId: item.id, title: item.title, url: item.url }, body),
);

/** Our notes on one lecture, by section (empty when we have none for that item). */
export function lectureNotes(itemId: string): readonly Section[] {
  const lecture = LECTURES.find((l) => l.item.id === itemId);
  return lecture ? sections(lecture.body) : [];
}

/** A player's own notes, chunked the same way (Markdown headings first, then recursive splitting). */
export function noteChunks(notes: readonly PersonalNote[]): Chunk[] {
  return notes.flatMap((n) => chunkMarkdown({ kind: "note", sourceId: n.id, title: n.title }, n.text));
}
