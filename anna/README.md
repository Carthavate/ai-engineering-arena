# The Arena as an Anna app

The same React app as the website, built for [Anna](https://anna.partners). It uses Anna's AI, Anna's storage and a popup GitHub sign-in, and plays against the same Supabase backend and leaderboard. Why and how: [ADR-0012](../docs/adr/0012-the-arena-as-an-anna-app.md).

| File | What it is |
|---|---|
| `app.json` | Store listing: slug `ai-engineering-arena`, name, description, version |
| `manifest.json` | What the app window may load: Supabase, GitHub avatars, YouTube, jsDelivr, Hugging Face |
| `bundle/` | Build output (not committed) |

## Build and check

```bash
cd site
npx vite build --mode anna          # writes ../anna/bundle (needs the Supabase URL and key in site/.env.local)
cd ../anna
anna-app validate --strict
```

`anna-app` is `@anna-ai/cli` and needs Node 22 or newer. Sign in once with `anna-app login --host https://anna.partners`.

## Publish

1. **Update the working draft:** `anna-app apps push`. It's private, only you see it.
2. **Make a version:** `anna-app apps publish --bump patch` freezes it as a new version, also private.
3. **Install it:** in the [Developer Console](https://anna.partners/developer), click **Install** on the app, then open it from the dashboard's app launcher.
4. **Release it:** `anna-app apps submit-review` asks Anna to review the newest version. Once approved, it appears in the Anna App Store.

If a push fails with a 403 "Blocked" page, Anna's upload firewall refused a file. Bisect with `anna-app apps push --bundle-dir <a copy with fewer files>` to find it.

## Sign-in

The popup returns to `anna-callback.html` on the website (`site/anna-callback.html`). That page must be deployed, and its exact URL must be in Supabase's redirect allowlist (Authentication → URL Configuration).
