# ADR-0013: Players can sign in with Google too, and everyone has a player name

- **Status:** Accepted
- **Date:** 2026-11-24
- **Amends:** [ADR-0009](0009-membership-by-github-identity.md)

## Context

Some people who'd like to play don't have a GitHub account. ADR-0009 made GitHub the only way in, partly because the site named every player by their GitHub username: the leaderboard, profile links, invites and every admin action used it.

A Google account has no username. Its name and photo are private to Google, and member profiles on the Arena are public.

## Decision

- **Two ways to sign in.**
  - Anyone can sign in with GitHub or with Google, on the website and in the Anna app.
  - Admins still let people in from the Players panel. Nobody plays without that approval.
- **Every player has a player name (`profiles.handle`).** It is unique ignoring case, and the site uses it in labels, links and admin actions.
  - A GitHub sign-up gets its username as its player name, as before.
  - A Google sign-up picks one at first sign-in: 3 to 39 letters, digits or single hyphens. The name can't be changed later.
  - A GitHub sign-up whose username someone here already holds picks one the same way. Their GitHub username is kept for the link to their GitHub profile.
- **Names can't be used to pose as someone.**
  - A player can't pick a name that another player already holds. They also can't pick a GitHub username that an admin invited or made an admin, because its owner may sign in later.
  - Only sign-ins that Supabase Auth records as GitHub or Google can pick a name. The provider is in `raw_app_meta_data`, which only the server writes. Email or other sign-ups stay invisible, as in ADR-0009.
  - Admin rights still come only from the GitHub admin list.
- **Google players' profiles are minimal.**
  - The public profile of a Google player has the player name only. Their Google name and photo are not copied.
  - Admins see the Google account's name in the Players panel, and only there, to know who is asking to join.
- **Admin actions are split by what they act on.**
  - Inviting ahead of sign-up stays GitHub-only (`invite_player`), since only a GitHub username can be known before someone signs in. `cancel_invite` takes such an invite back.
  - Everything else is done by player name: `let_in_player`, `decline_player`, `remove_player` and `delete_player`. Before this, "Let in" reused `invite_player`, and cancelling an invite reused `remove_player`. Now a Google player who picked a name can never be confused with a GitHub invite for the same name.

## Consequences

- The database has a new column and three new public functions (`claim_handle`, `let_in_player`, `cancel_invite`). `70_api_surface.sql` lists them.
- `decline_player`, `remove_player` and `delete_player` take a player name, through a parameter renamed to `p_handle`. The migration must be applied before the site that uses it goes live. Until the new site deploys, the old site's Decline, Remove and Delete buttons fail.
- A player whose name collides with a later GitHub sign-up keeps the name. The GitHub user picks another one. It's first come, first served, with admins approving every player.
- Google sign-in needs a Google OAuth client, set up once in Google Cloud and in Supabase (`site/README.md`). The redirect allowlist doesn't change: Google returns to the same pages as GitHub, including the Anna callback page (ADR-0012).
