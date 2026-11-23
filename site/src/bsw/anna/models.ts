import type { EmbedPort, LlmPort } from "../../rte/ports";
import type { Vec } from "../../swc/logic/lab/vectors";
import { hostError, type AnnaHost, type HostMessage } from "./host";

/** Anna's limits for one embed call: at most 64 inputs, each at most 32 000 characters (it rejects, never truncates). */
const EMBED_BATCH = 64;
const EMBED_MAX_CHARS = 32_000;

/** The Arena's prompts keep answers grounded in the notes, so a low temperature. */
const TEMPERATURE = 0.2;

/** Answers written by the model the player picked in Anna, billed to their Anna credits. */
export function annaLlm(host: AnnaHost): LlmPort {
  let stopCurrent: (() => void) | null = null;
  return {
    info: {
      label: "Anna's AI",
      detail: "Answers are written by the model you picked in Anna, through Anna's AI service. Nothing to download.",
    },

    async load(cb) {
      cb?.onDevice?.("host");
      return "host";
    },

    async generate(messages, maxTokens, cb) {
      const systemPrompt = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const chat: HostMessage[] = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
      // Anna answers in one piece, so "stop" can only drop the answer that's still on its way.
      const stopped = new Promise<string>((resolve) => { stopCurrent = () => resolve(""); });
      const answer = host.llm
        .complete({ messages: chat, maxTokens, temperature: TEMPERATURE, ...(systemPrompt ? { systemPrompt } : {}) })
        .then((res) => res.content.text ?? "", (e: unknown) => { throw hostError(e, "The AI couldn't answer"); });
      try {
        const text = await Promise.race([answer, stopped]);
        if (text) cb?.onText?.(text);
        return text;
      } finally {
        stopCurrent = null;
      }
    },

    stop() {
      stopCurrent?.();
    },
  };
}

/** Embeddings from Anna's embedding model, in batches Anna accepts. */
export function annaEmbedder(host: AnnaHost): EmbedPort {
  return {
    info: {
      label: "Anna's embedding model",
      detail: "Uses Anna's embedding model, through Anna's AI service. Nothing to download.",
    },

    async embed(texts, onProgress) {
      const out: Vec[] = [];
      for (let start = 0; start < texts.length; start += EMBED_BATCH) {
        const batch = texts.slice(start, start + EMBED_BATCH).map((t) => t.slice(0, EMBED_MAX_CHARS) || " ");
        const res = await host.llm.embed({ input: batch }).catch((e: unknown) => {
          throw hostError(e, "Couldn't embed the text");
        });
        const byIndex = [...res.data].sort((a, b) => a.index - b.index);
        if (byIndex.length !== batch.length) throw new Error("Couldn't embed the text: Anna returned the wrong number of vectors.");
        out.push(...byIndex.map((d) => d.embedding));
        onProgress(Math.round((out.length / texts.length) * 100));
      }
      return out;
    },
  };
}
