/** Where the model runs: on the player's GPU or CPU, or on the host (Anna's model, in the Anna app). */
export type LlmDevice = "webgpu" | "wasm" | "host";

/** How the UI describes a model before and while it runs. */
export interface ModelInfo {
  /** Finishes "Write answers with …", e.g. "the local AI (Qwen2.5, about 800 MB the first time)". */
  readonly label: string;
  /** One or two sentences: which model, where it runs, what it downloads. */
  readonly detail: string;
}

/** Where a running model is, for "AI running on …". */
export function deviceLabel(device: LlmDevice): string {
  if (device === "webgpu") return "your GPU";
  if (device === "wasm") return "your CPU (slower)";
  return "Anna's model";
}

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LlmCallbacks {
  /** 0-100 while the model downloads (first use only). */
  readonly onProgress?: (pct: number) => void;
  readonly onDevice?: (device: LlmDevice) => void;
  /** The whole answer so far, each time a new piece arrives. */
  readonly onText?: (text: string) => void;
}

/** The prompt the Mini RAG sends: the retrieved chunks as numbered context, then the question. */
export function ragMessages(question: string, chunks: readonly string[]): ChatMessage[] {
  const context = chunks.map((c, i) => `[${i + 1}] ${c.trim()}`).join("\n\n");
  return [
    {
      role: "system",
      content:
        "You answer questions using only the context provided. Cite the chunks you used like [1]. " +
        "If the context does not contain the answer, say you don't know. Keep answers short.",
    },
    { role: "user", content: `Context:\n${context}\n\nQuestion: ${question.trim()}` },
  ];
}
