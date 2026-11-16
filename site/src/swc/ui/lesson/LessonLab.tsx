import { labLinksFor } from "../../logic/lab/labLinks";
import type { RoadmapItem } from "../../logic/roadmap";
import { href } from "../../logic/route";
import type { LabData } from "../labData";

/** "Practise in the Lab": the explore pages and coding challenges that go with this lesson. Nothing when there are none. */
export function LessonLab({ item, data }: { readonly item: RoadmapItem; readonly data: LabData }) {
  const links = labLinksFor(item.id);
  if (links.length === 0) return null;
  const me = data.me;
  const solved = new Set(me ? data.solves.filter((s) => s.user_id === me.id).map((s) => s.challenge_id) : []);

  return (
    <section className="lesson-section" aria-labelledby="lesson-lab-title">
      <div className="lesson-section-head">
        <h3 id="lesson-lab-title">Practise in the Lab</h3>
        <span className="muted small-text">Runs in your browser</span>
      </div>
      <ul className="lesson-lab">
        {links.map((l) => (
          <li key={l.lab}>
            <a className="lesson-lab-card" href={href({ page: "lab", lab: l.lab })}>
              <span className="lesson-lab-tags">
                {l.kind === "explore"
                  ? <span className="lesson-lab-kind">Explore</span>
                  : <>
                      <span className="lesson-lab-kind kind-challenge">Challenge</span>
                      <span className={`level level-${l.level}`}>{l.level}</span>
                      <span className="xp-chip">+{l.xp} XP</span>
                      {solved.has(l.lab) && <span className="solved-pill">Solved</span>}
                    </>}
              </span>
              <span className="lesson-lab-title">{l.title} →</span>
              {l.kind === "explore" && <span className="muted small-text">{l.why}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
