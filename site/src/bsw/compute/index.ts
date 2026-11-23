import type { EmbedPort, LlmPort } from "../../rte/ports";
import type { ModelInfo } from "../../swc/logic/lab/llm";
import { embed } from "./embedder";
import { computeCore } from "./core";
import { generate, loadLlm, stopGenerating } from "./llm";

const EMBEDDER: ModelInfo = {
  label: "a small embedding model in your browser",
  detail: "Runs a real embedding model in your browser (about 23 MB, downloaded once, then cached).",
};

const LLM: ModelInfo = {
  label: "the local AI (Qwen2.5, about 800 MB the first time)",
  detail: "Qwen2.5-0.5B-Instruct, running in your browser. First use downloads about 800 MB on a GPU or 500 MB on CPU (cached after that), so try it on Wi-Fi.",
};

/** Python, models and tokenizers, each running in its own Web Worker (off the UI thread). */
export const compute = {
  ...computeCore,
  embedder: { info: EMBEDDER, embed } satisfies EmbedPort,
  llm: { info: LLM, load: loadLlm, generate, stop: stopGenerating } satisfies LlmPort,
};
