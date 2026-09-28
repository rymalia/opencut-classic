---
session_id: 8b0aa7bd-b663-49ec-84d8-40819ff132ab
date: 2026-09-27
time: "2026-09-26 10:32 PM PDT – 2026-09-27 01:07 AM PDT"
project: opencut-classic
---

# Session Summary: Stale service worker on localhost:3000

### Overview

After a fresh install, `http://localhost:3000/` showed a "Something went wrong — HttpError: 404 Not Found" page. OpenCut itself was fine: a service worker left in Chrome by a previously installed app (`@kimuson/claude-code-viewer`) was taking over the page. After the service worker and its caches were removed, the OpenCut homepage and editor loaded with no console errors. Docker was not running, and the user chose not to use it.

### The Bug

- **Symptom:** The browser showed an error card reading "HttpError: 404 Not Found". The tab title was "Claude Code Viewer", and assets loaded from `/assets/*.js`, which is Vite-style output, not Next.js.
- **Server side was healthy:** `next-server (v16.1.3)` (PID 44929, cwd `apps/web`) was the only listener on port 3000 (`*:3000`, tcp46). `curl` to `localhost`, `127.0.0.1`, and `[::1]` each returned `<title>OpenCut</title>` with HTTP 200.
- **Root cause:** Checked with `navigator.serviceWorker` in the page. `http://localhost:3000/sw.js` was controlling the page, with scope `http://localhost:3000/`. Its caches were `workbox-precache-v2-http://localhost:3000/` and `api-cache`. The service worker served the old viewer app's cached shell. That shell then called its own API, which OpenCut doesn't have, and got 404s (errors came from `AuthProvider-*.js` → `queryFn`).

### Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| **Unregister the service worker and delete its caches from the page itself** | Only this browser's data for `localhost:3000` was affected. A cache can't hold user work, and this was the most direct fix. |
| **Stop the recurrence by uninstalling the viewer (user's choice)** | I suggested giving `claude-code-viewer` its own port with an alias (`--port 3400`). The user preferred to remove the package because they no longer use it. |
| **Run OpenCut without Docker (user's choice)** | The README says Docker is optional for frontend work. I confirmed that the editor works without it. |

### Changes Made

| Change | Detail |
|--------|--------|
| **Chrome site data for `localhost:3000`** | Unregistered the `sw.js` service worker and deleted the caches `workbox-precache-v2-http://localhost:3000/` and `api-cache`. Afterward: 0 registrations, 0 caches. |
| **Test project created** | Clicking "New project" created an empty project stored in the browser (editor URL `/editor/3a0f4991-c4a8-4414-8974-e776ca9523b1`). |
| **`@kimuson/claude-code-viewer` removed** | The user uninstalled it. I confirmed that `which claude-code-viewer` finds nothing and `npm ls -g` doesn't list it. |
| **Repository files** | No changes, apart from this summary. |

### Testing / Research Performed

- `lsof` / `netstat`: one listener on port 3000 (the OpenCut `next-server`).
- `curl` against localhost, 127.0.0.1, and [::1]: all returned the OpenCut HTML.
- In the browser (claude-in-chrome): screenshots and console errors before and after the fix. After the fix, the homepage rendered as OpenCut with no console errors.
- `/projects` → "New project" → the editor loaded with no console errors, and Docker was not running.
- `claude-code-viewer --help` showed that it supports `-p/--port`, which is what the alias suggestion was based on.

### Summary Statistics

- Root causes found: 1 (a stale service worker from another app on the same origin)
- Browser storage items removed: 1 service worker registration and 2 Cache Storage caches
- Repository source files modified: 0

### Discoveries / Handoff Notes

- Chrome scopes a service worker to one origin (scheme + host + port). Any app that installs one on `localhost:3000` can take over OpenCut's dev server later. If you see pages from a different app or odd 404s, check DevTools → Application → Service workers first.
- Without Docker, anything that needs the database or Redis (sign-in, accounts) won't work. The editor and its local projects work without it.
- The purple boxes labelled with component names (e.g. `Skeleton ×2`) that cover the editor in dev mode come from a developer tool bundled with the repo that highlights redraws. They are not a bug, and they are not left over from the old service worker.

### Current State

- The OpenCut dev server was still running on port 3000 at the end of the session (PID 44929 when last checked).
- Docker is not running, by the user's choice.
- The empty test project still exists in the browser.
- The worktree on `main` was clean apart from this summary file.

### Unfinished Work

None. Optional: delete the empty test project from `/projects`.
