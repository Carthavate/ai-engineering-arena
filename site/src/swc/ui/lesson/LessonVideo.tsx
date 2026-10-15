import { useState } from "react";
import { embedUrl, thumbnailUrl, youtubeId } from "../../logic/lesson";
import type { RoadmapItem } from "../../logic/roadmap";

/** The lesson's YouTube video, 16:9. Shows the thumbnail first; the player (and YouTube) loads only on play. */
export function LessonVideo({ item }: { readonly item: RoadmapItem }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(item.url);

  if (!id) {
    if (item.url) {
      return <p className="lesson-source"><a href={item.url} target="_blank" rel="noopener">{item.source ?? "Open the resource"} ↗</a></p>;
    }
    return item.source ? <p className="lesson-source muted">{item.source}</p> : null;
  }

  return (
    <div className="lesson-video-wrap">
      <div className="lesson-video">
        {playing ? (
          <iframe
            src={embedUrl(id)}
            title={`Video: ${item.title}`}
            allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button type="button" className="lesson-play" onClick={() => setPlaying(true)} aria-label={`Play the video: ${item.title}`}>
            <img src={thumbnailUrl(id)} alt="" referrerPolicy="no-referrer" />
            <span className="lesson-play-icon" aria-hidden="true"><b>▶</b> Play video</span>
          </button>
        )}
      </div>
      <a className="small-text" href={item.url} target="_blank" rel="noopener">Watch on YouTube ↗</a>
    </div>
  );
}
