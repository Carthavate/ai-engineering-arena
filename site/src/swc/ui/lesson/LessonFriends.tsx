import { bestScores } from "../../logic/activity";
import type { RoadmapItem } from "../../logic/roadmap";
import { Avatar } from "../components/Avatar";
import type { LabData } from "../labData";

/** Who finished this lesson, and everyone's best quiz score on it. */
export function LessonFriends({ item, data }: { readonly item: RoadmapItem; readonly data: LabData }) {
  const best = bestScores(data.quizResults, item.id);
  const finished = (userId: string) => item.id in (data.progress[userId] ?? {});
  const shown = data.members.filter((m) => finished(m.id) || best[m.id]);

  return (
    <section className="lesson-section" aria-labelledby="lesson-friends-title">
      <h3 id="lesson-friends-title">Friends</h3>
      {shown.length === 0 ? (
        <p className="muted small-text">Nobody has finished this one yet. Be the first.</p>
      ) : (
        <ul className="lesson-friends">
          {shown.map((m) => {
            const s = best[m.id];
            return (
              <li key={m.id}>
                <Avatar member={m} size={28} color={data.colorOf(m.id)} />
                <span className="lesson-friend-name">{m.github_username}</span>
                {finished(m.id) && <span className="solved-pill">finished</span>}
                {s && (
                  <span className={`score${s.score === s.total ? " perfect" : ""}`} title={`Best quiz score of ${m.github_username}`}>
                    best quiz {s.score}/{s.total}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
