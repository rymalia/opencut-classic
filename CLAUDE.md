# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read `AGENTS.md` too — it holds the architecture rules (business logic belongs in `rust/`; apps are UI shells).

## Status

This is the **archived "classic" OpenCut** (upstream: `OpenCut-app/opencut-classic`). It is the working editor; the ground-up rewrite lives in a separate repo (`OpenCut-app/opencut`). This clone is a personal fork: `origin` = `rymalia/opencut-classic`, `upstream` = the maintainer repo (push disabled).

## Commands

Bun monorepo (workspaces `apps/*`, `packages/*`) driven by turbo, plus a Cargo workspace for the Rust crates. Run from the repo root unless noted.

```bash
bun install
bun dev:web                  # Next.js 16 + Turbopack on :3000 (apps/web)
bun build:web
bun lint:web                 # eslint over apps/web/src
bun test                     # bun's test runner, all *.test.ts
bun test apps/web/src/retime/__tests__/split.test.ts   # single file
bun test -t "name pattern"   # filter by test name

cargo test -p <crate>        # crates: time, bridge, effects, gpu, masks, compositor
bun run build:wasm           # wasm-pack build rust/wasm -> rust/wasm/pkg
cargo run -p opencut-desktop # desktop app (placeholder window only)
```

DB scripts (drizzle) live in `apps/web/package.json` (`db:generate`, `db:migrate`, `db:push:local`). Postgres/Redis come from `docker compose up -d db redis serverless-redis-http`, but they're optional; the editor runs without them (only auth/accounts need them). Env: copy `apps/web/.env.example` to `apps/web/.env.local`.

### Environment gotchas

- **`bunfig.toml` pins `linker = "hoisted"`.** Bun ≥1.3 defaults workspaces to the isolated linker, which leaves the root `node_modules` nearly empty; `@tailwindcss/postcss` then fails with `Can't resolve 'tailwindcss' in .../apps`. Don't remove it.
- **After reinstalling deps or changing bun versions, delete `apps/web/.next`.** A stale cache once contained a 0-byte `.next/dev/build/postcss.js`, which made `next-server` spawn thousands of idle PostCSS workers while `Compiling /…` hung forever.
- `next.config.ts` sets `turbopack.root` to the monorepo root because a stray lockfile in a parent directory can otherwise hijack root inference.
- `next dev` holds a lock at `apps/web/.next/dev/lock`; a second instance (even on another port) fails. Kill any test server before handing back.
- Dev mode injects **React Scan** from unpkg (`src/app/layout.tsx`) — the purple re-render outlines. Toggle it via its on-page toolbar.
- `bun test` relies on two preloads registered in `bunfig.toml` `[test]`: `apps/web/src/wasm/test-preload.ts` (a bun plugin that instantiates `opencut-wasm`'s `.wasm` — the package is built for the bundler target, which bun's runtime can't load) and `apps/web/src/text/test-preload.ts` (a fixed-metrics `OffscreenCanvas`, since bun has no canvas). Run tests from the repo root so `bunfig.toml` is picked up. CI doesn't run tests, so drift goes unnoticed — run them yourself.

## Architecture

### Web editor (`apps/web/src`)

Top-level folders are **domains** (`timeline`, `preview`, `effects`, `masks`, `animation`, `retime`, `text`, `media`, `subtitles`, …), imported via the `@/` alias. There is no `src/lib` or `src/stores` anymore — docs under `docs/` still reference those old paths, so map them to the matching domain folder (e.g. `src/lib/actions` → `src/actions`).

- **`core/`** — `EditorCore` is a singleton that owns every manager (`timeline`, `playback`, `scenes`, `project`, `media`, `renderer`, `save`, `audio`, `selection`, `clipboard`, `diagnostics`, `command`). UI reaches editor state through it rather than through scattered stores. Construction registers the default effects and masks.
- **`commands/`** — all mutations go through `Command` subclasses (`execute` / `undo` / `redo`, returning an optional selection patch) run by `CommandManager`, which gives undo/redo. `BatchCommand` groups several. The command manager also runs "reactors" after commands (e.g. pruning empty overlay/audio tracks).
- **`actions/`** — the user-trigger layer: action definitions → keybindings/buttons/context menus → handlers. Keybindings persist in localStorage and have versioned migrations; adding a default shortcut needs a migration. See `docs/actions.md`.
- **`services/renderer/`** — builds a scene graph from the timeline (`scene-builder`, `nodes/`) and renders it via canvas plus a GPU path (`gpu-renderer`, `compositor/`). Effects are defined in TS as pass templates (shader id + uniforms); the Rust/wgpu side owns devices, textures, and pass execution. See `docs/effects-renderer.md`.
- **`services/storage/`** — projects and media are local-first: IndexedDB and OPFS adapters with versioned migrations. No server storage is needed for editing.
- **`wasm/`** — the thin TS bridge to `opencut-wasm` (the published npm build of `rust/wasm`), e.g. media-time math.

`docs/keyframes.md` covers the animation/keyframe model. `notes/primitives-vs-domains.md` describes an in-progress refactor: move pure value types (e.g. `Transform`, currently in `rendering/`) out of domain folders into primitives, one deliberate move at a time.

### Rust (`rust/`)

`rust/crates/*` are platform-agnostic crates; `bridge` provides an `#[export]` macro that is a no-op natively and expands to `#[wasm_bindgen]` (camelCase JS name) with `--features wasm`. `rust/wasm` aggregates them into the WASM package. The web app uses the **published** `opencut-wasm` package unless you `bun link` a local build (README "Local WASM development"). `gpu` uses wgpu, with the WebGL backend under the `wasm` feature.

### Desktop (`apps/desktop`)

GPUI app, currently just a window with a title — no editor functionality and no crate wiring. Setup in `apps/desktop/README.md`.

## Conventions

- Formatting: Prettier (tabs, per `.prettierrc.json`); lint: ESLint (`eslint.config.mjs`). `.github/copilot-instructions.md` is a long generic Ultracite rule list (strict TS, a11y rules, `for…of` over `forEach`, no `console`, `node:` imports, no `<img>` in Next.js); follow what the linter enforces.
- React: read a component before using it — many already apply classes (from `AGENTS.md`).
