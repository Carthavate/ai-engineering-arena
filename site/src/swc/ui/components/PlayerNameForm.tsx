import { useId, useState, type FormEvent } from "react";
import { isPlayerName } from "../../logic/players";
import type { Outcome } from "../../logic/types";

interface PlayerNameFormProps {
  /** Their GitHub username, when they signed in with GitHub but someone here already has that name. */
  readonly takenGithub: string;
  readonly claim: (name: string) => Promise<Outcome<string>>;
}

/** Shown once, right after signing in without a player name (a Google account, or a GitHub username already taken). */
export function PlayerNameForm({ takenGithub, claim }: PlayerNameFormProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const picked = name.trim().replace(/^@/, "");
    if (!isPlayerName(picked)) {
      setError("Use 3 to 39 letters, digits or single hyphens, like rag-wizard.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await claim(picked);
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <section className="panel name-picker" aria-labelledby={titleId}>
      <h2 id={titleId} className="panel-title">Pick your player name</h2>
      <p id={hintId} className="muted">
        {takenGithub && <>Someone here is already called {takenGithub}, so pick another name. </>}
        Other players see it on the leaderboard, in duels and in the link to your profile. It can't be changed later.
      </p>
      <form className="invite-form" onSubmit={(e) => void submit(e)}>
        <label className="sr-only" htmlFor={inputId}>Player name</label>
        <input id={inputId} className="lab-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. rag-wizard"
          maxLength={40} autoComplete="nickname" spellCheck={false}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId} aria-invalid={error ? true : undefined} />
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save"}</button>
      </form>
      {error && <p id={errorId} className="form-error" role="alert">{error}</p>}
    </section>
  );
}
