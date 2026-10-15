import { describe, expect, it } from "vitest";
import { embedUrl, lessonNoteId, lessonStatus, locateLesson, thumbnailUrl, youtubeId } from "./lesson";
import { PHASES } from "./roadmap";

describe("youtubeId", () => {
  it("reads watch urls with or without a playlist", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dHgvDTXVvPA&list=PLNIQLFWpQMRUMjxfe8o6g3uzJ6LH_VotY")).toBe("dHgvDTXVvPA");
    expect(youtubeId("https://www.youtube.com/watch?v=dHgvDTXVvPA")).toBe("dHgvDTXVvPA");
    expect(youtubeId("https://youtube.com/watch?list=PLx&v=63B-3rqRFbQ&t=42")).toBe("63B-3rqRFbQ");
    expect(youtubeId("https://m.youtube.com/watch?v=i_v4Vm2KBuc")).toBe("i_v4Vm2KBuc");
  });

  it("reads short, embed and shorts urls", () => {
    expect(youtubeId("https://youtu.be/9iGvXxH_fdE?t=10")).toBe("9iGvXxH_fdE");
    expect(youtubeId("https://www.youtube-nocookie.com/embed/9iGvXxH_fdE")).toBe("9iGvXxH_fdE");
    expect(youtubeId("https://www.youtube.com/shorts/9iGvXxH_fdE")).toBe("9iGvXxH_fdE");
  });

  it("rejects playlists, other sites, bad ids and junk", () => {
    expect(youtubeId("https://www.youtube.com/playlist?list=PLNIQLFWpQMRUMjxfe8o6g3uzJ6LH_VotY")).toBeNull();
    expect(youtubeId("https://karpathy.ai/zero-to-hero.html")).toBeNull();
    expect(youtubeId("https://evil.com/watch?v=dHgvDTXVvPA")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=\"><script>x")).toBeNull();
    expect(youtubeId("javascript:alert(1)")).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
    expect(youtubeId(undefined)).toBeNull();
  });

  it("finds a video for every RAG lecture", () => {
    const rag = PHASES.find((p) => p.id === "rag")!;
    expect(rag.items.every((i) => youtubeId(i.url) !== null)).toBe(true);
  });

  it("builds privacy-friendly embed and thumbnail urls", () => {
    expect(embedUrl("dHgvDTXVvPA")).toBe("https://www.youtube-nocookie.com/embed/dHgvDTXVvPA?autoplay=1&rel=0");
    expect(thumbnailUrl("dHgvDTXVvPA")).toBe("https://i.ytimg.com/vi/dHgvDTXVvPA/hqdefault.jpg");
  });
});

describe("locateLesson", () => {
  it("finds the phase and the neighbours", () => {
    const at = locateLesson("rag-12")!;
    expect(at.phase.id).toBe("rag");
    expect(at.item.id).toBe("rag-12");
    expect(at.prev?.id).toBe("rag-11");
    expect(at.next?.id).toBe("rag-13");
  });

  it("crosses phase boundaries and stops at both ends", () => {
    expect(locateLesson("rag-17")!.next?.id).toBe("p0-1");
    expect(locateLesson("p0-1")!.prev?.id).toBe("rag-17");
    expect(locateLesson("rag-1")!.prev).toBeNull();
    expect(locateLesson("p7-5")!.next).toBeNull();
  });

  it("returns null for unknown ids", () => {
    expect(locateLesson("nope")).toBeNull();
    expect(locateLesson("")).toBeNull();
  });
});

describe("lessonStatus", () => {
  it("keeps done lessons done, whatever the quiz says", () => {
    expect(lessonStatus({ done: true, hasQuiz: true, passed: false })).toBe("done");
    expect(lessonStatus({ done: true, hasQuiz: false, passed: false })).toBe("done");
  });

  it("gates quiz lessons on passing", () => {
    expect(lessonStatus({ done: false, hasQuiz: true, passed: false })).toBe("quiz-gate");
    expect(lessonStatus({ done: false, hasQuiz: true, passed: true })).toBe("passed");
  });

  it("lets lessons without a quiz be marked by hand", () => {
    expect(lessonStatus({ done: false, hasQuiz: false, passed: false })).toBe("todo");
  });
});

describe("lessonNoteId", () => {
  it("is stable per lesson", () => {
    expect(lessonNoteId("rag-12")).toBe("lesson:rag-12");
    expect(lessonNoteId("rag-12")).toBe(lessonNoteId("rag-12"));
  });
});
