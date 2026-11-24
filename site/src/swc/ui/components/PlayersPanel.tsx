import { useRef, useState, type FormEvent } from "react";
import { relativeTime } from "../../logic/activity";
import type { LabData } from "../labData";
import { type PlayersAdmin } from "../../../rte/usePlayers";
import { Avatar } from "./Avatar";
import { DeletePlayerConfirm } from "./DeletePlayerConfirm";
import { accountLabel, cleanGithubInput, isGithubUsername, playerLabel } from "../../logic/players";

type Note = { readonly ok: boolean; readonly text: string } | null;

/**
 * Admin-only: let people who signed in become players, invite GitHub usernames ahead of time, remove or delete
 * players. Everyone who signed in is named by their player name (handle).
 */
export function PlayersPanel({ data, admin }: { readonly data: LabData; readonly admin: PlayersAdmin }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const panelRef = useRef<HTMLElement>(null);
  if (!data.me?.is_admin) return null;

  /** One action at a time: the others are disabled until it settles. */
  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    if (busy !== null) return;
    setBusy(key);
    setNote(null);
    const res = await fn();
    setBusy(null);
    setConfirm(null);
    setDeleting(null);
    setNote(res.ok ? { ok: true, text: success } : { ok: false, text: res.error ?? "Something went wrong." });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const github = cleanGithubInput(name);
    if (!isGithubUsername(github)) {
      setNote({ ok: false, text: "That doesn't look like a GitHub username." });
      return;
    }
    void run("invite", async () => {
      const res = await admin.invite(github);
      if (res.ok) setName("");
      return res;
    }, `@${github} is in. If they haven't signed in yet, they become a player the moment they do.`);
  };

  const askDelete = (handle: string) => {
    setConfirm(null);
    setNote(null);
    setDeleteError(null);
    setDeleting(handle);
  };
  const cancelDelete = (handle: string) => {
    setDeleting(null);
    setDeleteError(null);
    // Back to the button that opened the form (names are letters, digits and dashes: safe in a selector).
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>(`[data-delete-for="${handle}"]`)?.focus());
  };
  /** Unlike the other actions, a failed delete keeps its form open and shows the error there. */
  const confirmDelete = async (handle: string) => {
    if (busy !== null) return;
    setBusy(`del-${handle}`);
    setNote(null);
    setDeleteError(null);
    const res = await admin.delete(handle);
    setBusy(null);
    if (res.ok) {
      setDeleting(null);
      setNote({ ok: true, text: `@${handle} is deleted, with everything they did here.` });
    } else {
      setDeleteError(res.error);
    }
  };
  // Someone who hasn't picked a player name yet can't be named, so they can't be deleted here.
  const deleteButton = (handle: string, className = "btn btn-ghost btn-small") => handle !== "" && (
    <button type="button" className={className} disabled={busy !== null} onClick={() => askDelete(handle)}
      data-delete-for={handle} aria-label={`Delete @${handle} for good`}>Delete</button>
  );
  const deleteConfirm = (handle: string) => deleting === handle && (
    <DeletePlayerConfirm key={handle} name={handle} busy={busy !== null} pending={busy === `del-${handle}`} error={deleteError}
      onCancel={() => cancelDelete(handle)} onConfirm={() => void confirmDelete(handle)} />
  );

  const players = data.members.filter((m) => !m.is_admin);
  const waiting = admin.overview?.waiting ?? [];
  const invited = admin.overview?.invited ?? [];
  const declined = admin.overview?.declined ?? [];

  return (
    <section ref={panelRef} className="panel players-panel" id="players-panel" aria-labelledby="players-title">
      <div className="panel-head">
        <h2 id="players-title" className="panel-title">Players</h2>
        <span className="admin-tag">Admins only</span>
      </div>
      <p className="muted small-text">
        Players can tick quests, take quizzes, duel and race, and they show up on the leaderboard.
        People sign in with GitHub or Google and pick a player name. You can invite GitHub usernames ahead of time;
        Google players show up below once they've signed in.
        This has nothing to do with the GitHub repo: nobody gets repo access from being a player.
        Remove hides a player and keeps their history; Delete erases them and everything they did, for good.
      </p>

      <form className="invite-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="invite-name">GitHub username</label>
        <input id="invite-name" className="lab-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="GitHub username, e.g. octocat" autoComplete="off" spellCheck={false} />
        <button type="submit" className="btn btn-primary" disabled={busy !== null || !name.trim()}>{busy === "invite" ? "Inviting…" : "Invite"}</button>
      </form>
      {note && <p className={note.ok ? "players-ok" : "form-error"} role="status">{note.text}</p>}
      {admin.error && <p className="form-error">{admin.error}</p>}

      <h3 className="players-sub">Waiting to join {waiting.length > 0 && <span className="duel-badge">{waiting.length}</span>}</h3>
      {waiting.length === 0 ? (
        <p className="empty">Nobody's waiting. When someone signs in and picks a player name, they show up here.</p>
      ) : (
        <ul className="player-rows">
          {waiting.map((w) => (
            <li key={w.handle}>
              <Avatar member={{ id: w.handle, handle: w.handle, github_username: w.github_username, display_name: w.display_name, avatar_url: w.avatar_url, is_member: false }} size={34} color="var(--edge)" />
              <span className="player-row-name">
                <b>{playerLabel(w)}</b>
                <span className="muted small-text">@{w.handle} · {accountLabel(w)} · signed in {relativeTime(w.signed_in_at, data.now)}</span>
              </span>
              <span className="player-actions">
                <button type="button" className="btn btn-primary btn-small" disabled={busy !== null}
                  onClick={() => void run(w.handle, () => admin.letIn(w.handle), `${playerLabel(w)} is now a player.`)}>
                  {busy === w.handle ? "Letting in…" : "Let in"}
                </button>
                <button type="button" className="btn btn-ghost btn-small" disabled={busy !== null}
                  onClick={() => void run(`no-${w.handle}`, () => admin.decline(w.handle), `Declined @${w.handle}. You can still let them in later.`)}>
                  {busy === `no-${w.handle}` ? "Declining…" : "Decline"}
                </button>
                {deleteButton(w.handle)}
              </span>
              {deleteConfirm(w.handle)}
            </li>
          ))}
        </ul>
      )}

      {declined.length > 0 && (
        <details className="declined-list">
          <summary>Declined ({declined.length})</summary>
          <ul className="invited-chips">
            {declined.map((d) => (
              <li key={d.handle} title={accountLabel(d)}>
                @{d.handle}
                <button type="button" className="btn-link" disabled={busy !== null}
                  onClick={() => void run(d.handle, () => admin.letIn(d.handle), `${playerLabel(d)} is now a player.`)}>Let in</button>
                {deleteButton(d.handle, "btn-link")}
              </li>
            ))}
          </ul>
          {declined.map((d) => deleteConfirm(d.handle))}
        </details>
      )}

      {invited.length > 0 && (
        <>
          <h3 className="players-sub">Invited, not signed in yet</h3>
          <ul className="invited-chips">
            {invited.map((g) => (
              <li key={g}>
                @{g}
                <button type="button" className="chip-x" aria-label={`Cancel the invite for ${g}`} disabled={busy !== null}
                  onClick={() => void run(`invite-${g}`, () => admin.cancelInvite(g), `Invite for @${g} cancelled.`)}>×</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="players-sub">Players</h3>
      {players.length === 0 ? <p className="empty">Only admins so far.</p> : (
        <ul className="player-rows">
          {players.map((m) => (
            <li key={m.id}>
              <Avatar member={m} size={34} color={data.colorOf(m.id)} />
              <span className="player-row-name">
                <b>{playerLabel(m)}</b>
                <span className="muted small-text">@{m.handle}{m.github_username ? "" : " · Google"}</span>
              </span>
              {confirm === m.handle ? (
                <span className="remove-confirm">
                  Remove?{" "}
                  <button type="button" className="btn btn-ghost btn-small" disabled={busy !== null}
                    onClick={() => void run(m.handle, () => admin.remove(m.handle), `@${m.handle} is no longer a player. Their history is kept but hidden.`)}>Yes</button>
                  <button type="button" className="btn-link" onClick={() => setConfirm(null)}>No</button>
                </span>
              ) : (
                <span className="player-actions">
                  <button type="button" className="btn btn-ghost btn-small" disabled={busy !== null}
                    onClick={() => { setDeleting(null); setConfirm(m.handle); }}>Remove</button>
                  {deleteButton(m.handle)}
                </span>
              )}
              {deleteConfirm(m.handle)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
