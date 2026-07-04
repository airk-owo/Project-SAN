# ARCHITECTURE

WTK Online — real-time multiplayer hidden-role card game (San Guo Sha style, Thai UI).
Server-authoritative online play, plus an offline **local** mode that runs the same engine in the browser.

## 1. Tech Stack
- **Monorepo:** npm workspaces (`apps/*`, `packages/*`). All TypeScript 5.7, ESM (`"type":"module"`).
- **Engine:** Pure-TS package `@wtk/game` (framework-agnostic, zero runtime deps). Published as raw source (`"exports":"./src/index.ts"`) — imported directly, no build step.
- **Backend:** Node.js 22 + Express 4 + Socket.io 4, run via `tsx watch`. Live game state is **in-memory** (no DB on the gameplay path).
- **Frontend:** Next.js 15 (App Router) + React 19 + socket.io-client 4. Tailwind 3 is installed/configured but **inert** — there are no `@tailwind` directives, so utility classes emit no CSS. Styling lives in `app/styles.css` (semantic classes + CSS variables), not utility classes.
- **Auth/persistence:** Supabase (`@supabase/supabase-js`) — Postgres + Google OAuth.
- **Deploy:** Docker (`node:22-slim`); config via `.env.example`.

## 2. Directory Tree
- `apps/server/` — Realtime Socket.io + Express server. Everything lives in `src/index.ts`.
- `apps/web/` — Next.js client:
  - `app/page.tsx` — **Online** multiplayer client (lobby → seating → gameplay). Owns the socket and renders server-pushed `game:state`. Does **not** import the engine.
  - `app/game/local/page.tsx` — **Offline** single-device / hotseat mode. Runs `@wtk/game` **client-side**; no server, no persistence.
  - `app/game/mock/page.tsx` — Static table-layout mockup for design iteration (presentational only, no engine/data).
  - `app/login/page.tsx` · `app/layout.tsx` · `app/styles.css` — auth entry, root layout, global styles.
  - `components/` — `LobbyTable`, `SeatButton`, `ReadyPanel`, `SpectatorList`.
  - `lib/` — `supabase.ts` (client), `tableRotation.ts` (rotate seats so the local viewer sits at the bottom).
- `packages/game/` — Pure-TS rules engine (`src/index.ts`) + 16 `tsx --test` suites (combat, instant/delayed tricks, character skills, reconnect, seating, roles…).
- `data/generated/` — Boot-loaded runtime JSON (`cards.json`, `characters.json`, `rules.json`, `manual.json`). Do not hand-edit.
- `source/` — Content source of truth: CSVs (`01_card_instances` … `08_backend_events`), DOCX/PDF manual, art (`Image/`), fonts (`Font/`).
- `scripts/` — Pipeline `source/` → `data/generated/`: `import-manual-docx.ps1` (DOCX → JSON), `import-cards.mjs` (CSV/JSON → runtime JSON).
- `supabase/migrations/0001_initial.sql` — Postgres schema + RLS.
- `docs/` — Specs & notes (`architecture-decisions`, `card-effect-logic`, `game-state`, `lobby-seat-system`, `current-status`, `troubleshooting`, …).

## 3. Core Modules
- `packages/game/src/index.ts` (~1.5k lines) — the engine. A rich `GameState` model plus a large family of `Pending*` interaction states (repeat attack, destroy mount, ice-sword replace, twin swords, coerce, harvest, judgment, fankui, retaliate, legacy, peek, dischord, ally-assist). Key exports:
  - `createGame`, `createSeatedPlayer`, `dealRoles`, `dealEmperorOptions`, `beginPlayAfterCharacters` — setup / seating / role & character dealing.
  - `synchronizeGameState`, `getPlayerById` — core state helpers (the two most-connected functions in the graph).
  - `createPublicGameState(state, viewerId)` — per-viewer redaction that hides opponent hands/roles. (`publicState` is a `@deprecated` alias the server still calls.)
  - `CHARACTER_SKILLS` + `hasCharacterSkill` + `SKILL_EVENT_HANDLERS` + `dispatchGameEvent` — character-skill system driven by an event/subscriber model.
  - `setCardNameVersion` / `CardNameVersion` — switch card names between `modern` and `classic`.
- `apps/server/src/index.ts` — Socket gateway (~75 `socket.on` handlers: `room:*` / `seat:*` / `player:ready` / `game:start`, `card:play`, `attack:*`, all `skill:*`, judgment & response flows, `chat:send`). Holds `games` and `connections` Maps. `emitGame` builds a **per-viewer** payload: redacted state + pairwise `distances` + `roleAliveCounts` + `characterSkillKeys` + response deadline. Auto-skip is driven by a `DECISION_SECONDS` map (default **15s**; peek/retaliate/legacy **60s**), one timer per game via `refreshTimeout`. HTTP routes: `/health`, `/rooms`, `/cards`, `/characters` (the last two feed the client-side card/character encyclopedia). Auth via `requireUser`.
- `apps/web/app/page.tsx` — the online client screens; all state derives from incoming `game:state`.
- `apps/web/app/game/local/page.tsx` — imports the engine directly and drives a full game in-browser (offline).
- `apps/web/lib/supabase.ts` — Supabase client (Google OAuth, persistent stats).
- `data/generated/rules.json` — roles, hand sizes, per-count role compositions, authoritative setup.
- `supabase/migrations/0001_initial.sql` — DB schema (`profiles`, `game_sessions`, `game_participants`).

## 4. Data & Control Flow
**Online (server-authoritative):**
- **Boot:** Server loads `data/generated/*.json` into memory.
- **Join:** Client emits `room:join` → server authenticates, maps user → `GameState` in `games`. Players pick seats (`seat:*`), toggle `player:ready`, then the host `game:start`s (5s cancellable countdown → `dealRoles` → character selection).
- **Sync:** Any mutation calls `emitGame` → `createPublicGameState` redacts per player → broadcasts `game:state` (with distances, role counts, skill keys, deadline).
- **Action:** Player emits `card:play` / `attack:*` / `skill:*` → `requireUser` auth → `@wtk/game` mutates state → server re-broadcasts via `emitGame`. Skill triggers fire through `dispatchGameEvent`.
- **Timeouts:** `refreshTimeout` runs exactly one timer per game and auto-declines the pending decision when the `DECISION_SECONDS` clock expires.

**Offline (local):** `app/game/local/page.tsx` builds a `GameState` and calls the same engine functions directly in the browser — no socket, no server, no DB.

**Persistence:** The client talks to Supabase directly for auth and stats; live game state remains in server memory only.
