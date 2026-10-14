import { describe, expect, it } from "vitest";
import { LECTURE_CHUNKS, noteChunks } from "./coursePack";
import { chunkMarkdown, parseFrontMatter, recursiveSplit, searchableText, sections, textHash } from "./documents";
import { answerMessages, attribute, citations, cleanStandalone, standaloneMessages, stripCitations } from "./prompt";
import { bm25Index, bm25Search, retrieve, rrf, terms, vectorSearch } from "./search";

describe("ingestion", () => {
  it("reads front matter and markdown sections", () => {
    const { meta, body } = parseFrontMatter("---\nitem: rag-15\n---\nIntro\n## Formula\nscore = 1/(k+rank)\n## k\nk = 60");
    expect(meta.item).toBe("rag-15");
    expect(sections(body)).toEqual([
      { heading: "", body: "Intro" },
      { heading: "Formula", body: "score = 1/(k+rank)" },
      { heading: "k", body: "k = 60" },
    ]);
  });

  it("splits recursively within the size limit, preferring paragraph and sentence boundaries", () => {
    const text = "First paragraph is short.\n\nSecond paragraph has two sentences. It goes on a bit longer than the first one.";
    const chunks = recursiveSplit(text, 60, 0);
    expect(chunks.every((c) => c.length <= 60)).toBe(true);
    expect(chunks[0]).toBe("First paragraph is short.");
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("It goes on a bit longer");
  });

  it("repeats text between chunks when asked for overlap, and never exceeds the size", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const chunks = recursiveSplit(words, 80, 20);
    expect(chunks.every((c) => c.length <= 80)).toBe(true);
    const lastOfFirst = chunks[0].split(" ").at(-1)!;
    expect(chunks[1].split(" ")).toContain(lastOfFirst);
    expect(() => recursiveSplit("x", 10, 10)).toThrow();
    expect(recursiveSplit("   ", 10, 0)).toEqual([]);
  });

  it("builds chunks with their source and section", () => {
    const [c] = chunkMarkdown({ kind: "note", sourceId: "n1", title: "My notes" }, "## BM25\nKeyword search.");
    expect(c).toMatchObject({ kind: "note", title: "My notes", heading: "BM25", text: "Keyword search.", sourceId: "n1" });
    expect(searchableText(c)).toBe("My notes\nBM25\nKeyword search.");
  });

  it("hashes text stably for the embedding cache", () => {
    expect(textHash("hello")).toBe(textHash("hello"));
    expect(textHash("hello")).not.toBe(textHash("hello!"));
  });
});

describe("the course pack", () => {
  it("has notes for all 17 RAG lectures, each linked to its video", () => {
    const lectures = new Set(LECTURE_CHUNKS.map((c) => c.sourceId));
    expect(lectures.size).toBe(17);
    for (let i = 1; i <= 17; i++) expect(lectures.has(`rag-${i}`)).toBe(true);
    expect(LECTURE_CHUNKS.every((c) => c.kind === "lecture" && c.url?.startsWith("https://www.youtube.com/"))).toBe(true);
    expect(new Set(LECTURE_CHUNKS.map((c) => c.id)).size).toBe(LECTURE_CHUNKS.length);
  });

  it("chunks personal notes the same way", () => {
    const chunks = noteChunks([{ id: "n1", title: "Week 1", text: "## Chroma\nStores vectors.", addedAt: "t" }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe("note");
  });
});

describe("retrieval", () => {
  const docs = [
    "BM25 keyword search scores exact terms with term frequency and inverse document frequency",
    "Cosine similarity compares the direction of two embedding vectors",
    "Reciprocal rank fusion adds 1 / (k + rank) across ranked lists, k is often 60",
  ];

  it("tokenizes into lowercase terms without stopwords", () => {
    expect(terms("What is the BM25 score of a 7.5 billion deal?")).toEqual(["bm25", "score", "7.5", "billion", "deal"]);
  });

  it("finds exact keywords with BM25", () => {
    const hits = bm25Search(bm25Index(docs), "how does reciprocal rank fusion work", 3);
    expect(hits[0].index).toBe(2);
    expect(bm25Search(bm25Index(docs), "unrelated banana", 3)).toEqual([]);
  });

  it("ranks vectors by cosine similarity", () => {
    expect(vectorSearch([1, 0], [[0, 1], [1, 0], [0.7, 0.7]], 2).map((h) => h.index)).toEqual([1, 2]);
  });

  it("fuses lists with reciprocal rank fusion (k = 60), rewarding agreement", () => {
    const fused = rrf([[{ index: 0, score: 9 }, { index: 1, score: 8 }], [{ index: 1, score: 5 }, { index: 2, score: 4 }]]);
    expect(fused[0]).toMatchObject({ index: 1, ranks: [2, 1] });
    expect(fused[0].score).toBeCloseTo(1 / 62 + 1 / 61);
    expect(fused.find((f) => f.index === 2)?.ranks).toEqual([null, 2]);
  });

  it("returns a full trace and picks only relevant fused chunks", () => {
    const vectors = [[1, 0, 0], [0.5, 0.5, 0.7], [0, 0, 1]];
    const trace = retrieve("reciprocal rank fusion", [0, 0, 1], bm25Index(docs), vectors, { top: 2 });
    // Chunk 2 matches by keyword and meaning; chunk 1 only by meaning (cosine 0.7, above the floor);
    // chunk 0 is unrelated (cosine 0, no keyword) and is never picked.
    expect(trace.picked).toEqual([2, 1]);
    expect(trace.keyword.length).toBeGreaterThan(0);
    expect(trace.vector).toHaveLength(3);
  });
});

describe("prompts", () => {
  const source = chunkMarkdown({ kind: "lecture", sourceId: "rag-15", title: "#15 RRF" }, "## Formula\nscore = sum of 1/(k+rank)")[0];

  it("numbers the sources, keeps recent history and ends with the question", () => {
    const msgs = answerMessages("  What is k? ", [source], [{ question: "What is RRF?", answer: "A fusion method [1]." }]);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toMatch(/only the numbered sources/);
    expect(msgs.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(msgs.at(-1)!.content).toBe("Sources:\n[1] score = sum of 1/(k+rank)\n\nQuestion: What is k?");
  });

  it("asks for a standalone rewrite and keeps it only if it looks like one question", () => {
    expect(standaloneMessages("and its k?", [{ question: "What is RRF?", answer: "Fusion." }])[1].content).toContain("Last question: and its k?");
    expect(cleanStandalone('Question: "What is the k constant in RRF?"\nextra', "and its k?")).toBe("What is the k constant in RRF?");
    expect(cleanStandalone("", "and its k?")).toBe("and its k?");
  });

  it("extracts valid citations", () => {
    expect(citations("Use BM25 [2] and RRF [1][2]; not [9].", 3)).toEqual([1, 2]);
  });

  it("credits each sentence to the source it overlaps most when the model didn't cite", () => {
    const sources = [
      chunkMarkdown({ kind: "lecture", sourceId: "rag-16", title: "#16 Hybrid search" }, "## BM25\nBM25 keyword search matches exact terms like product names.")[0],
      chunkMarkdown({ kind: "lecture", sourceId: "rag-8", title: "#8 Chunking" }, "## Overlap\nChunk overlap repeats text between neighbouring chunks.")[0],
    ];
    const { text, added } = attribute("Chunk overlap repeats text between chunks. BM25 matches exact product names! Nice weather.", sources);
    expect(added).toBe(true);
    expect(text).toBe("Chunk overlap repeats text between chunks [2]. BM25 matches exact product names [1]! Nice weather.");
    expect(attribute("Already cited [1].", sources)).toEqual({ text: "Already cited [1].", added: false });
  });
});

describe("review fixes", () => {
  it("never reads headings inside fenced code, keeps 'C#', and chains an empty parent heading", () => {
    expect(sections("Intro\n```python\n# load the model\nx = 1\n```\nafter")).toEqual([
      { heading: "", body: "Intro\n```python\n# load the model\nx = 1\n```\nafter" },
    ]);
    expect(sections("## Learning C#\nbody")[0].heading).toBe("Learning C#");
    expect(sections("# Week 1\n## Chroma\nStores vectors.")).toEqual([{ heading: "Week 1 › Chroma", body: "Stores vectors." }]);
  });

  it("tokenizes accents, other scripts and possessives", () => {
    expect(terms("Génération augmentée")).toEqual(["generation", "augmentee"]);
    expect(terms("What's RRF's k?")).toEqual(["rrf", "k"]);
    expect(terms("مرحبا بكم")).toEqual(["مرحبا", "بكم"]);
  });

  it("returns no sources for off-topic questions (relevance floor)", () => {
    const idx = bm25Index(["BM25 keyword search", "cosine similarity of vectors"]);
    const trace = retrieve("weather in Tunis", [0, 0, 1], idx, [[1, 0, 0], [0, 1, 0]]);
    expect(trace.vector).toHaveLength(2);
    expect(trace.picked).toEqual([]);
  });

  it("keeps line breaks and list items when matching citations, and drops invalid markers", () => {
    const sources = [
      chunkMarkdown({ kind: "lecture", sourceId: "rag-16", title: "#16" }, "## BM25\nBM25 keyword search matches exact terms.")[0],
      chunkMarkdown({ kind: "lecture", sourceId: "rag-15", title: "#15" }, "## RRF\nReciprocal rank fusion merges ranked lists.")[0],
    ];
    const { text } = attribute("Steps:\n\n- BM25 keyword search matches exact terms\n- reciprocal rank fusion merges ranked lists", sources);
    expect(text).toBe("Steps:\n\n- BM25 keyword search matches exact terms [1]\n- reciprocal rank fusion merges ranked lists [2]");
    expect(attribute("Fusion merges lists [7].", sources).text).not.toContain("[7]");
  });

  it("strips citation markers before reusing an answer as history", () => {
    expect(stripCitations("RRF merges lists [1]. BM25 [2] too.")).toBe("RRF merges lists. BM25 too.");
  });
});
