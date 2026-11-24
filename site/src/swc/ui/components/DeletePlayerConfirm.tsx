import { useId, useState, type FormEvent } from "react";

interface DeletePlayerConfirmProps {
  /** The player name to delete (typed back to confirm). */
  readonly name: string;
  /** Some admin action is running: nothing can be sent. */
  readonly busy: boolean;
  /** This delete is the one running. */
  readonly pending: boolean;
  /** Why the last try failed (the form stays open so the admin can retry). */
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Deleting can't be undone, so the admin types the player name first (like deleting a GitHub repo). */
export function DeletePlayerConfirm({ name, busy, pending, error, onConfirm, onCancel }: DeletePlayerConfirmProps) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const warningId = useId();
  const matches = name !== "" && typed.trim().toLowerCase() === name.toLowerCase();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches && !busy) onConfirm();
  };

  return (
    <form className="delete-confirm" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape" && !pending) onCancel(); }}>
      <p id={warningId}>
        <b>Delete @{name} for good?</b> This erases their account, progress, quiz results, solves and every duel
        and race they played, so the other player loses that duel's XP too. It can't be undone. If they sign in
        again, they start from zero and wait to be let in.
      </p>
      <label htmlFor={inputId}>Type <code>{name}</code> to confirm</label>
      <span className="delete-confirm-row">
        <input id={inputId} className="lab-input" value={typed} onChange={(e) => setTyped(e.target.value)}
          aria-describedby={warningId} autoComplete="off" spellCheck={false} autoFocus />
        <button type="submit" className="btn btn-danger btn-small" disabled={!matches || busy}>
          {pending ? "Deleting…" : "Delete forever"}
        </button>
        <button type="button" className="btn-link" onClick={onCancel} disabled={pending}>Cancel</button>
      </span>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
