// The lesson panel's rules: where a lesson sits on the roadmap, its video, and what it means for a player.
import { PHASES, type Phase, type RoadmapItem } from "./roadmap";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The YouTube video id of a lesson url: watch?v=… (with or without &list=…), youtu.be/…, /embed/…, /shorts/….
 * Anything else (playlists, other sites, malformed urls) gives null.
 */
export function youtubeId(url: string | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(?:embed|shorts|live)\/([^/]+)/.exec(u.pathname)?.[1] ?? null;
  } else if (host === "youtu.be") {
    id = u.pathname.slice(1).split("/")[0];
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** Privacy-friendly player url (no cookies until the video plays); only called after the player clicked play. */
export function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export interface LessonPlace {
  readonly phase: Phase;
  readonly item: RoadmapItem;
  /** Lessons before and after this one, across phases (null at either end of the roadmap). */
  readonly prev: RoadmapItem | null;
  readonly next: RoadmapItem | null;
}

/** Where a lesson sits on the roadmap, or null for an unknown id. */
export function locateLesson(itemId: string, phases: readonly Phase[] = PHASES): LessonPlace | null {
  const all = phases.flatMap((phase) => phase.items.map((item) => ({ phase, item })));
  const i = all.findIndex((e) => e.item.id === itemId);
  if (i < 0) return null;
  return { ...all[i], prev: all[i - 1]?.item ?? null, next: all[i + 1]?.item ?? null };
}

/**
 * A lesson for one player:
 *   done       finished (finished lessons stay finished)
 *   passed     quiz passed; the database ticks it, so it shows as done in a moment
 *   quiz-gate  has a quiz: completed only by passing it (4/5)
 *   todo       no quiz: can be marked done by hand
 */
export type LessonStatus = "done" | "passed" | "quiz-gate" | "todo";

export function lessonStatus(s: { readonly done: boolean; readonly hasQuiz: boolean; readonly passed: boolean }): LessonStatus {
  if (s.done) return "done";
  if (!s.hasQuiz) return "todo";
  return s.passed ? "passed" : "quiz-gate";
}

/** One private note per lesson; a fixed id so saving it again replaces it. */
export function lessonNoteId(itemId: string): string {
  return `lesson:${itemId}`;
}
