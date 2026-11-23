# ADR-0012: The Arena is also an Anna app, built from the same code

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Anna (anna.partners) is an "AI OS" with an app store. Its Founding Builder Program pays monthly grants to AI-native apps that reach 200+ monthly users, counted on Anna. We wanted the Arena there without maintaining a second app, and with one shared leaderboard.

An Anna app is a static bundle that Anna serves in a window on its own site. A probe app showed what that window allows:
- The bundle is served from `https://anna.partners`, the origin every Anna app shares. Browser storage works, but other apps' scripts can read it.
- Only the bundle's own scripts run, not CDN scripts.
- Each file may be at most 10 MB, and the bundle at most 50 MB.
- Popups and `fetch` to declared origins work.
- Anna provides an LLM, embeddings and per-app, per-user storage, with no API key.

## Decision

- **One codebase, two builds.**
  - `vite build` makes the website.
  - `vite build --mode anna` writes the same React app to `anna/bundle/`.
  - Anna-only code lives in `bsw/anna/` and `app/anna.tsx`; screens are unchanged (ADR-0005).
- **Same backend.**
  - The Anna build uses the same Supabase project, RPCs and row-level security.
  - Anna players are the same GitHub players on the same leaderboard (ADR-0009).
- **Anna's models instead of in-browser ones.**
  - `LlmPort` and `EmbedPort` call Anna's `llm.complete` and `llm.embed`. The in-browser runtime (onnxruntime) is 14 to 27 MB, over Anna's file limit.
  - This makes "Ask the course" the app's AI-native core.
  - The ports now describe their model (`info`), so the UI never claims an Anna answer ran in the browser.
- **Python is bundled.**
  - Pyodide's core (its largest file is 9.6 MB) ships inside the bundle.
  - Its packages still come from jsDelivr, which is allowed through `connect-src`.
- **Notes go to Anna's per-app storage.**
  - Notes are stored in the app's per-user Anna storage, which no other app can read.
  - Embeddings stay in memory only.
- **Sign-in happens in a popup.**
  - Anna's page can't be redirected away, and Anna answers any popup request for an app's files with its login page. So GitHub sign-in opens a popup that returns to `anna-callback.html` on the website.
  - That page posts the one-time PKCE code to `window.opener`, addressed to `https://anna.partners`. The app accepts it only from the popup it opened, on the website's origin, and exchanges it with the verifier it holds in memory.
  - Every Anna app shares the anna.partners origin, so another app could start its own sign-in that returns to the same page. The page therefore hands the code over only after a click on "Finish signing in to the Arena", and says to continue only if the player just clicked Sign in in the Arena.
  - The Supabase session lives in memory. The refresh token is kept in the app's Anna storage so the player stays signed in between windows. Anna already serves the app's code, so this adds no new party to trust.

## Consequences

- One feature, two places: every change ships to both builds, so `npm test` covers the shared code.
- The Anna bundle is published with the `anna-app` CLI (`anna/README.md`), not by CI.
- Answers in the Anna app cost the player's Anna credits. On the website they stay free and local (ADR-0006).
- Anna's upload firewall rejects code that looks like template injection, such as `#{` followed by `.exec(`. A regex was rewritten for that.
- Anna's sign-in return page depends on the website being deployed. The Supabase redirect allowlist contains exactly that page's URL.
- Anna apps aren't isolated from each other: they share one origin, so a malicious app the player installs could read the Arena window's memory, session included. We can't fix that from inside the app; it is Anna's trust model. Keep the allowlist entry exact, never a `carthavate.github.io` wildcard.
