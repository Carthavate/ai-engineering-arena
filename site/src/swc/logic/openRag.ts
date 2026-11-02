// Open RAG, the offline app we built from the RAG course, is the prize for clearing that course.
import { phaseDone } from "./gamify";
import type { Phase } from "./roadmap";

export const OPEN_RAG_REPO = "https://github.com/Carthavate/open-rag-engine";
export const OPEN_RAG_PHASE = "rag";

/** The setup is split because GitHub release files max out at 2 GiB (the language model alone is 2.5 GB).
 * Setup finds the parts when they sit in the same folder as the .exe. */
export const OPEN_RAG_FILES = ["OpenRag-Setup.exe", "OpenRag-Setup-1.bin", "OpenRag-Setup-2.bin"] as const;

/** Always the newest release, so the site needs no change when a new version ships under the same file names. */
export const downloadUrl = (file: string) => `${OPEN_RAG_REPO}/releases/latest/download/${file}`;

export interface OpenRagReward {
  readonly unlocked: boolean;
  readonly done: number;
  readonly total: number;
}

/** The reward on the RAG course phase (null on every other phase): unlocked once every lesson is ticked. */
export function openRagReward(phase: Phase, done: Readonly<Record<string, string>>): OpenRagReward | null {
  if (phase.id !== OPEN_RAG_PHASE) return null;
  return {
    unlocked: phaseDone(phase, done),
    done: phase.items.filter((i) => i.id in done).length,
    total: phase.items.length,
  };
}
