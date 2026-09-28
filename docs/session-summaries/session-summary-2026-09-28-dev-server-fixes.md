---
session_id: a6f6b9be-53d5-4aa8-9bb0-ef0e2677cde6
date: 2026-09-28
time: "11:38 AM PDT – 12:36 PM PDT"
project: opencut-classic
---

# Session Summary: Getting `bun dev:web` working on bun 1.4

### Overview

`bun dev:web` failed with `Can't resolve 'tailwindcss'` and then hung forever on `Compiling /projects`. Both problems are fixed and the editor now loads quickly. The repo now pushes to the user's fork, a `CLAUDE.md` was added, and the fixes are committed.

### The Bugs

1. **`Can't resolve 'tailwindcss' in '.../opencut-classic/apps'`**
   - **Wrong first guess:** a stray empty `package.json` plus an 87-byte `package-lock.json` in `~/projects/` (dated Sep 26) caused a Next.js "multiple lockfiles" warning. Pinning `turbopack.root` silenced the warning, but the error remained.
   - **Actual cause:** the user's bun is 1.4.0, but the repo pins `bun@1.2.18`. Bun ≥1.3 defaults workspaces to the *isolated* linker, which left only 17 entries in the root `node_modules`. `@tailwindcss/postcss` resolves `@import "tailwindcss"` from `apps/` (the parent of the cwd `apps/web`), walks up to the root `node_modules`, and finds nothing there.
   - **Fix:** a `bunfig.toml` with `[install] linker = "hoisted"`, then `bun install` (948 packages). `node_modules/tailwindcss` then existed.
2. **`Compiling /projects ...` hung for 16+ minutes**
   - `next-server` ran at about 96–106% CPU. A `sample` showed it mostly waiting and repeatedly calling `fork`. It had over 3,800 child `node .next/dev/build/postcss.js` workers, all idle at 0% CPU, with about 7 more starting each second.
   - **Cause:** `apps/web/.next/dev/build/postcss.js` was **0 bytes**. It sat in a build cache left over from Sep 26, before the reinstall.
   - **Fix:** killed the server and workers, then deleted `apps/web/.next`. After the rebuild the file was 879 bytes, and `GET /projects` returned 200 in 3.6s (compile 3.4s) with 1 worker.
3. **Self-inflicted problems:** my first test used `timeout`, which isn't on macOS, so it never ran. A later test server kept running on :3055 and held `.next/dev/lock`, so the user's `bun dev:web` failed with "Unable to acquire lock". I killed it. On the final test I cleaned up properly and checked that no processes remained.

### Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| **Pin `linker = "hoisted"` in `bunfig.toml`** rather than downgrading bun | Restores the layout the repo was built for and works for any bun version. |
| **Keep the `turbopack.root` edit** even though it wasn't the fix | Harmless, and it stops a parent-directory lockfile from hijacking root inference. |
| **Delete `.next` rather than debug the empty worker file** | It's a disposable cache, and deleting it fixed the problem immediately. |
| **Don't upgrade turbo** (2.9.6 → 2.11.5) | The repo is archived and turbo only runs a single-package dev task here, so upgrading brings churn with no benefit. |
| **Leave React Scan in place** | The user turned it off with its on-page toolbar. |
| **Remotes: `origin` = fork, `upstream` = maintainer, upstream push URL `DISABLED`** | Fork-only contribution flow: a push can never reach the maintainer repo. |
| **Committed directly this time** | The user explicitly approved it, overriding the global no-commit rule. The user then added `CLAUDE.local.md` to allow commits in this repo from now on. |

### Changes Made

| Change | Detail |
|--------|--------|
| **`bunfig.toml`** (new) | `[install] linker = "hoisted"` |
| **`apps/web/next.config.ts`** | `turbopack: { root: path.join(__dirname, "../..") }` |
| **`CLAUDE.md`** (new) | Commands, environment gotchas, and a map of the web/Rust/desktop architecture |
| **`.gitignore`** | Now ignores `CLAUDE.local.md` and `.DS_Store` |
| **Git remotes** | `origin` → `rymalia/opencut-classic`; old origin renamed `upstream` (fetch only); `main` tracks `origin/main` |
| **Commits** | `7a4b1e61 fix(web): make dev server work with bun 1.3+`, `a2df59cb docs: add CLAUDE.md ...`, plus the commit that includes this summary |
| **Not committed / local** | Deleted and rebuilt `apps/web/.next`; reinstalled `node_modules`. `bun.lock` was unchanged. |

### Testing / Research Performed

- Dev server started on :3055 after the linker fix: no resolve error, and `/projects` returned 200 after deleting `.next`.
- `bun test`: 175 tests across 31 files, **5 fail**. Four suites error with `wasm.__wbindgen_start is not a function`: `opencut-wasm` is built for bundlers and doesn't load under bun. One imports `isShortcutKey`, which `src/actions/keybinding.ts` no longer exports. Neither is caused by this session. The single-file run `retime/__tests__/split.test.ts` passed 4/4.
- Compared the desktop app with the web app. Classic `apps/desktop` is a 41-line window that just shows a title. The rewrite (`~/projects/OpenCut`, last commit e6680107, Sep 24) has a desktop app of about 1,256 lines: themes, UI components, and four placeholder panels, with no editing. Its only Rust crate is `crates/media` (FFmpeg build setup). Its web app is about 7k lines, versus about 91k in classic.
- Checked that `rymalia/opencut-classic` exists as a fork of `OpenCut-app/opencut-classic` (`gh repo view`).

### Summary Statistics

- 2 root causes found (bun isolated linker; empty PostCSS worker in the stale `.next`) plus 1 false lead (stray lockfile)
- 4 repo files changed (`bunfig.toml`, `next.config.ts`, `CLAUDE.md`, `.gitignore`) plus this summary
- 3 commits

### Discoveries / Handoff Notes

- After any bun version change or reinstall, delete `apps/web/.next` before `bun dev:web`.
- Only one `next dev` can run per checkout (`.next/dev/lock`). Kill any test server before handing back to the user.
- macOS has no `timeout`. Run test servers in the background and kill them by PID or pattern.
- The purple outlines in dev come from React Scan, loaded from unpkg in `src/app/layout.tsx`.
- Docker was not running, so Postgres and Redis were down. Editing works without them; only auth needs them.
- The stray `~/projects/package.json` and `package-lock.json` still exist. They're harmless now that `turbopack.root` is pinned, and safe to delete.

### Current State

- On `main`, 3 commits ahead of `origin/main`, **not pushed**. Push with `git push -u origin main`.
- No dev servers left running from this session.

### Unfinished Work

- Push to the fork (`git push -u origin main`).
- Optional: fix the 5 failing tests (WASM loading under bun; the stale `isShortcutKey` import).
- Optional: delete the stray `~/projects/package.json` and `package-lock.json`.
