// What the "What is RAG?" scene shows: the parts of a RAG system, the wires between them,
// and three guided tours (indexing time, query time, and the same question without RAG).

export type PartId = "docs" | "chunker" | "embedder" | "vectordb" | "question" | "prompt" | "llm" | "answer";

export interface Part {
  readonly id: PartId;
  readonly label: string;
  /** One line on the callout tag. */
  readonly caption: string;
  /** The paragraph shown when the part is selected. */
  readonly detail: string;
}

export type EdgeId =
  | "docs-chunker" | "chunker-embedder" | "embedder-vectordb" | "question-embedder"
  | "vectordb-prompt" | "question-prompt" | "prompt-llm" | "llm-answer" | "question-llm";

export interface Edge {
  readonly id: EdgeId;
  readonly from: PartId;
  readonly to: PartId;
}

export type TourMode = "index" | "query" | "norag";
export type Stage = "indexing" | "retrieval" | "augmentation" | "generation" | "no-retrieval";

export interface TourStep {
  readonly title: string;
  readonly text: string;
  readonly stage: Stage;
  readonly parts: readonly PartId[];
  readonly edges: readonly EdgeId[];
}

export const PARTS: readonly Part[] = [
  { id: "docs", label: "Your documents", caption: "Private, fresh facts",
    detail: "Files the LLM never saw in training: a shop's return policy, warranty terms, product manuals. Retrieval lets the model use them without retraining." },
  { id: "chunker", label: "Chunker", caption: "Cuts docs into passages",
    detail: "Splits each document into small chunks so search can return just the passage that matters. Chunk size and overlap change answer quality (lessons #3 and #8)." },
  { id: "embedder", label: "Embedding model", caption: "Text → vector",
    detail: "Turns text into a vector: a list of numbers where texts with similar meaning land close together. The same model embeds the chunks and the question, so they can be compared." },
  { id: "vectordb", label: "Vector database", caption: "Finds the closest chunks",
    detail: "Stores every chunk's vector with its text. Given the question's vector, it returns the top-k most similar chunks, usually by cosine similarity (lesson #5)." },
  { id: "question", label: "Question", caption: "What the user asks",
    detail: "Each question starts query time. Everything before it (chunking, embedding, storing) was indexing time and ran once." },
  { id: "prompt", label: "Augmented prompt", caption: "Question + sources",
    detail: "The retrieved chunks are pasted into the prompt next to the question, with an instruction: answer only from these sources, cite them, and say \"I don't know\" if they don't help." },
  { id: "llm", label: "LLM", caption: "Writes the answer",
    detail: "The language model. On its own it only knows its training data, which stops at its knowledge cutoff. With RAG it reads the sources in the prompt and writes from them." },
  { id: "answer", label: "Answer", caption: "Grounded, with a citation",
    detail: "A grounded answer points at its source, so you can check it. Without retrieval, the answer can sound just as sure and still be made up: a hallucination." },
];

/** The answer's tag when the model answered without retrieval. */
export const GUESS_CAPTION = "A guess, no source";

/** A part's one-line caption; the answer's depends on whether retrieval ran. */
export function captionOf(part: Part, grounded: boolean): string {
  return part.id === "answer" && !grounded ? GUESS_CAPTION : part.caption;
}

export const EDGES: readonly Edge[] = [
  { id: "docs-chunker", from: "docs", to: "chunker" },
  { id: "chunker-embedder", from: "chunker", to: "embedder" },
  { id: "embedder-vectordb", from: "embedder", to: "vectordb" },
  { id: "question-embedder", from: "question", to: "embedder" },
  { id: "vectordb-prompt", from: "vectordb", to: "prompt" },
  { id: "question-prompt", from: "question", to: "prompt" },
  { id: "prompt-llm", from: "prompt", to: "llm" },
  { id: "llm-answer", from: "llm", to: "answer" },
  { id: "question-llm", from: "question", to: "llm" },
];

export const TOUR_MODES: readonly TourMode[] = ["index", "query", "norag"];

export const TOUR_LABELS: Record<TourMode, string> = {
  index: "1 · Indexing time",
  query: "2 · Query time",
  norag: "Without RAG",
};

export const STAGE_LABELS: Record<Stage, string> = {
  indexing: "Indexing time · runs once",
  retrieval: "Retrieval step",
  augmentation: "Augmentation",
  generation: "Generation step",
  "no-retrieval": "No retrieval",
};

export const TOURS: Record<TourMode, readonly TourStep[]> = {
  index: [
    { title: "Collect the documents", stage: "indexing", parts: ["docs"], edges: [],
      text: "Start with files the LLM has never seen: the return policy, the warranty, the e-bike manual." },
    { title: "Split them into chunks", stage: "indexing", parts: ["docs", "chunker"], edges: ["docs-chunker"],
      text: "Each document is cut into small passages (here, one sentence each) so search can hand back only the relevant part." },
    { title: "Embed every chunk", stage: "indexing", parts: ["chunker", "embedder"], edges: ["chunker-embedder"],
      text: "The embedding model turns each chunk into a vector. Chunks about returns end up near each other, far from chunks about batteries." },
    { title: "Store the vectors", stage: "indexing", parts: ["embedder", "vectordb"], edges: ["embedder-vectordb"],
      text: "Vectors and their text go into the vector database. This all happens once, before anyone asks anything." },
  ],
  query: [
    { title: "A question arrives", stage: "retrieval", parts: ["question"], edges: [],
      text: "\"How many days do I have to return a bike?\" Query time starts." },
    { title: "Embed the question", stage: "retrieval", parts: ["question", "embedder"], edges: ["question-embedder"],
      text: "The same embedding model turns the question into a vector, so it can be compared with the stored chunks." },
    { title: "Find similar chunks", stage: "retrieval", parts: ["embedder", "vectordb"], edges: ["embedder-vectordb"],
      text: "The database returns the 3 chunks closest to the question's vector. The return policy comes first." },
    { title: "Augment the prompt", stage: "augmentation", parts: ["vectordb", "question", "prompt"], edges: ["vectordb-prompt", "question-prompt"],
      text: "The chunks are pasted into the prompt next to the question, with an instruction to answer only from them." },
    { title: "Generate", stage: "generation", parts: ["prompt", "llm"], edges: ["prompt-llm"],
      text: "The LLM reads the prompt and writes the answer from the sources, not from memory." },
    { title: "A grounded answer", stage: "generation", parts: ["llm", "answer"], edges: ["llm-answer"],
      text: "\"30 days from delivery (returns.md).\" Correct, current, and with a source you can check." },
  ],
  norag: [
    { title: "A question arrives", stage: "no-retrieval", parts: ["question"], edges: [],
      text: "The same question: \"How many days do I have to return a bike?\"" },
    { title: "Straight to the LLM", stage: "no-retrieval", parts: ["question", "llm"], edges: ["question-llm"],
      text: "No retrieval: the LLM only has its training data, which ends at its knowledge cutoff and never included this shop's files." },
    { title: "A confident guess", stage: "no-retrieval", parts: ["llm", "answer"], edges: ["llm-answer"],
      text: "\"Most shops give you 14 days.\" Wrong, with no source and no warning. That is a hallucination, and the reason RAG exists." },
  ],
};

/** The tour's step at index i, clamped to the first and last step. */
export function stepAt(mode: TourMode, i: number): TourStep {
  const tour = TOURS[mode];
  return tour[Math.min(Math.max(i, 0), tour.length - 1)];
}
