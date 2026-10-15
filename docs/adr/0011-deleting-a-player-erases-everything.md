# ADR-0011: Deleting a player erases everything, on both sides of their duels

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Admins can remove a player, which only hides them: their progress, quizzes, duels and solves stay in the database, and their duels still count for the people they played. TWadi and Ghassen also want to get rid of some accounts for good, for example test accounts and people who no longer play. A duel belongs to two players, so deleting one of them has to decide what happens to the other side.

## Decision

`delete_player(github)` is admin-only and refuses admins. It erases the person completely:

- the invite in `private.members`;
- the Supabase sign-in (`auth.users`), which cascades to the profile and every row that references it: progress, quiz attempts and their keys, challenge solves, duel entries, and duels and their keys;
- the other player's quiz attempts made from those duels (`source_duel`). On cascade they would only lose their link and turn into ordinary quizzes, so they are deleted first.

The whole duel disappears for both players, including the XP it gave the winner. A lecture someone completed through such a duel stays done (ADR-0008). If the deleted person signs in again, they get a new, empty profile and wait to be let in (ADR-0009).

The site asks the admin to type the username before deleting, because there is no undo. The database keeps one private audit line per delete in `private.admin_log` (which admin, which username, when) and lets each admin delete at most `private.delete_limit()` players (5) in 24 hours, so a stolen admin session can't wipe everyone.

## Consequences

Remove keeps history and is reversible; delete is final and leaves no trace of the person apart from the audit line, so the leaderboard is recomputed without them. Nobody can delete an admin from the site; that takes a migration. There is no undo: a mistaken delete can only be recovered from a database backup, if one exists.
