import type { KernelPort, PythonPort, TokenizerPort } from "../../rte/ports";
import { restartKernel, runCell } from "./kernel";
import { preloadPython, runChallenge } from "./pyRunner";
import { tokenize } from "./tokenizer";

/**
 * Python and tokenizers, each in its own Web Worker. Kept apart from the in-browser models (index.ts) so the
 * Anna build, which uses Anna's models instead, doesn't bundle them.
 */
export const computeCore = {
  python: { run: runChallenge, preload: preloadPython } satisfies PythonPort,
  kernel: { runCell, restart: restartKernel } satisfies KernelPort,
  tokenizer: { tokenize } satisfies TokenizerPort,
};
