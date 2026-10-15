import { useCallback, useEffect, useRef, useState } from "react";
import { href, nextView, parseRoute, type View } from "../swc/logic/route";

export interface RouteState {
  /** The page to show, and the lesson whose panel is open over it (if any). */
  readonly view: View;
  /** Show another lesson in the open panel (replaces the history entry, so Back still closes the panel). */
  readonly goToLesson: (itemId: string) => void;
  /** Close the panel: like pressing Back when the panel was opened here, else go to the page behind it. */
  readonly closeLesson: () => void;
}

/** The current page, from the URL hash; follows back/forward navigation. */
export function useRoute(): RouteState {
  const [view, setView] = useState(() => nextView(null, parseRoute(window.location.hash)));
  const viewRef = useRef(view);
  // True when the panel was opened from a page of this site, so there is a history entry to go back to.
  const openedHere = useRef(false);

  useEffect(() => {
    const onChange = () => {
      const prev = viewRef.current;
      const next = nextView(prev, parseRoute(window.location.hash));
      if (next.lesson && !prev.lesson) openedHere.current = true;
      if (!next.lesson) openedHere.current = false;
      viewRef.current = next;
      setView(next);
      // Opening or closing the panel keeps the page where it was; a different page starts at the top.
      if (href(next.page) !== href(prev.page)) window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const goToLesson = useCallback((itemId: string) => {
    window.location.replace(href({ page: "lesson", lesson: itemId }));
  }, []);

  const closeLesson = useCallback(() => {
    if (!viewRef.current.lesson) return;
    if (openedHere.current) window.history.back();
    else window.location.replace(href(viewRef.current.page));
  }, []);

  return { view, goToLesson, closeLesson };
}
