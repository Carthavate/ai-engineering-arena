import { downloadUrl, OPEN_RAG_FILES, OPEN_RAG_REPO, type OpenRagReward } from "../../logic/openRag";

const PITCH = "The offline app we built from this course: put your notes and PDFs in sections, ask questions, and get answers that cite the page. Nothing leaves your computer.";

/** The RAG course's prize: a locked teaser with the player's count, then the download once every lesson is ticked. */
export function OpenRagLoot({ reward }: { readonly reward: OpenRagReward }) {
  if (!reward.unlocked) {
    return (
      <section className="loot locked" aria-labelledby="loot-title">
        <span className="loot-tag">Bonus loot · locked</span>
        <h2 id="loot-title">Clear all {reward.total} lessons to unlock Open RAG</h2>
        <p>{PITCH}</p>
        <div className="loot-progress">
          <span className="crew-bar" style={{ ["--player" as string]: "var(--sun)" }}>
            <i style={{ width: `${(reward.done / reward.total) * 100}%` }} />
          </span>
          <span className="crew-num">{reward.done}/{reward.total}</span>
        </div>
      </section>
    );
  }
  return (
    <section className="loot unlocked" aria-labelledby="loot-title">
      <span className="loot-tag">Bonus loot · unlocked</span>
      <h2 id="loot-title">Open RAG is yours</h2>
      <p>{PITCH}</p>
      <ol className="loot-steps">
        <li>Download all {OPEN_RAG_FILES.length} files into the same folder.</li>
        <li>Run <b>{OPEN_RAG_FILES[0]}</b>. Windows may say the publisher is unknown: choose <i>More info</i>, then <i>Run anyway</i>.</li>
      </ol>
      <div className="loot-files">
        {OPEN_RAG_FILES.map((file, i) => (
          <a key={file} className={`btn ${i === 0 ? "btn-primary" : "btn-ghost"}`} href={downloadUrl(file)} download>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
            </svg>
            {file}
          </a>
        ))}
      </div>
      <p className="loot-meta">
        Windows 10 or 11 (64-bit) · 8 GB of RAM · about 6 GB of disk · free and <a href={OPEN_RAG_REPO}>open source</a>
      </p>
    </section>
  );
}
