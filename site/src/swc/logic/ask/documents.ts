// Turning notes into searchable chunks: the ingestion side of "Ask the course" (lessons #3, #8, #9).

export type SourceKind = "lecture" | "note";

/** One searchable piece of text, with enough context to cite it. */
export interface Chunk {
  readonly id: string;
  readonly kind: SourceKind;
  /** Lecture title or note title. */
  readonly title: string;
  /** Section heading inside the source, if any. */
  readonly heading: string;
  readonly text: string;
  /** Roadmap item (lectures) or note id. */
  readonly sourceId: string;
  /** Where to watch / read the original (lectures). */
  readonly url?: string;
}

/** A note a player added; kept only in their own browser. */
export interface PersonalNote {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly addedAt: string;
}

export interface Section {
  readonly heading: string;
  readonly body: string;
}

/** Split "---\nkey: value\n---\nbody" into its fields and body. */
export function parseFrontMatter(md: string): { readonly meta: Readonly<Record<string, string>>; readonly body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!m) return { meta: {}, body: md };
  const meta = Object.fromEntries(
    m[1].split(/\r?\n/).flatMap((line) => {
      const i = line.indexOf(":");
      return i > 0 ? [[line.slice(0, i).trim(), line.slice(i + 1).trim()]] : [];
    }),
  );
  return { meta, body: md.slice(m[0].length) };
}

/**
 * Markdown sections by heading (#, ##, ###). Text before the first heading gets an empty heading.
 * Lines inside fenced code (``` or ~~~) are never headings: a Python "# comment" stays code.
 * A heading with no text of its own is kept as a prefix of the next one ("Week 1 › Chroma").
 */
export function sections(md: string): Section[] {
  const out: Section[] = [];
  let heading = "";
  let lines: string[] = [];
  let fence: string | null = null;
  const flush = () => {
    const body = lines.join("\n").trim();
    if (body) out.push({ heading, body });
    return Boolean(body);
  };
  for (const line of md.split(/\r?\n/)) {
    const f = /^\s*(```|~~~)/.exec(line);
    if (f) fence = fence === null ? f[1] : fence === f[1] ? null : fence;
    // Closing #s count only when separated by a space, so "Learning C#" keeps its #.
    const h = fence === null && !f ? /^#{1,3}\s+(.+?)(?:\s+#+)?\s*$/.exec(line) : null;
    if (h) {
      const hadBody = flush();
      heading = !hadBody && heading ? `${heading} › ${h[1]}` : h[1];
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return out;
}

const SEPARATORS = ["\n\n", "\n", ". ", " ", ""] as const;

/**
 * Recursive character splitting (lesson #9): try paragraph breaks first, then lines, sentences, words,
 * and only as a last resort single characters. Pieces are then packed up to `size` characters, with
 * about `overlap` characters repeated between neighbouring chunks.
 */
export function recursiveSplit(text: string, size: number, overlap: number): string[] {
  if (size <= 0 || overlap < 0 || overlap >= size) throw new Error("Need size > 0 and 0 <= overlap < size");
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const pieces = splitPieces(clean, size, 0);
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length > size) {
      chunks.push(current.trim());
      // Carry the tail of the previous chunk forward, cut at a word boundary.
      const tail = current.slice(Math.max(0, current.length - overlap));
      const cut = tail.indexOf(" ");
      const carry = overlap > 0 && cut >= 0 ? tail.slice(cut + 1) : "";
      current = carry.length + piece.length <= size ? carry : "";
    }
    current += piece;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Break text into pieces no longer than size, keeping each separator attached to the piece before it. */
function splitPieces(text: string, size: number, level: number): string[] {
  if (text.length <= size) return [text];
  const sep = SEPARATORS[level];
  if (sep === undefined || sep === "") {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out;
  }
  const parts = text.split(sep);
  return parts.flatMap((part, i) => splitPieces(i < parts.length - 1 ? part + sep : part, size, level + 1));
}

/** Cut a markdown source into chunks: one per section, long sections split recursively. */
export function chunkMarkdown(
  source: { readonly kind: SourceKind; readonly sourceId: string; readonly title: string; readonly url?: string },
  md: string,
  size = 800,
  overlap = 80,
): Chunk[] {
  return sections(md).flatMap((s, si) =>
    recursiveSplit(s.body, size, overlap).map((text, ci) => ({
      id: `${source.sourceId}#${si}.${ci}`,
      kind: source.kind,
      title: source.title,
      heading: s.heading,
      text,
      sourceId: source.sourceId,
      url: source.url,
    })),
  );
}

/** The text that gets embedded and keyword-indexed: title and heading give each chunk its context. */
export function searchableText(c: Chunk): string {
  return [c.title, c.heading, c.text].filter(Boolean).join("\n");
}

/** Stable 53-bit hash (cyrb53) for caching embeddings by content. */
export function textHash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
