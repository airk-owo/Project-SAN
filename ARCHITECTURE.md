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
- `packages/game/` — Pure-TS rules engine (`src/index.ts` router + `src/engine/` modules) + 16 `tsx --test` suites (combat, instant/delayed tricks, character skills, reconnect, seating, roles…) and `basic-combat.scenarios.ts` (standalone scenario harness, not in `npm test`).
- `data/generated/` — Boot-loaded runtime JSON (`cards.json`, `characters.json`, `rules.json`, `manual.json`). Do not hand-edit.
- `source/` — Content source of truth: CSVs (`01_card_instances` … `08_backend_events`), DOCX/PDF manual, art (`Image/`), fonts (`Font/`).
- `scripts/` — Pipeline `source/` → `data/generated/`: `import-manual-docx.ps1` (DOCX → JSON), `import-cards.mjs` (CSV/JSON → runtime JSON).
- `supabase/migrations/0001_initial.sql` — Postgres schema + RLS.
- `docs/` — Specs & notes (`architecture-decisions`, `card-effect-logic`, `game-state`, `lobby-seat-system`, `current-status`, `troubleshooting`, …).

## 3. Core Modules
- `packages/game/src/index.ts` (~55 lines) — the Game Router and State Dispatcher. Re-exports the whole engine API (consumers keep importing from `@wtk/game`) and holds only `playCard` (effect-key dispatch to handlers), `respondToAttack`, and the legacy `effectResolvers` registry. All logic lives in `src/engine/`:
  - `engine/types.ts` — the full type model: `GameState`, `Player`, `Card` plus the `Pending*` interaction-state family (repeat attack, destroy mount, ice-sword replace, twin swords, coerce, harvest, judgment, fankui, retaliate, legacy, peek, dischord, ally-assist).
  - `engine/state.ts` — core state helpers: `synchronizeGameState`, `getPlayerById` (the two most-connected functions in the graph), zones/logging/draw-pile/pending-draw utilities.
  - `engine/actions.ts` — targeted-card action framework (`createTargetedCardAction`, `canPlayerAct`, `canPlayCardNow`).
  - `engine/setup.ts` — `createGame`, `createSeatedPlayer`, `dealRoles`, `dealEmperorOptions`, `beginPlayAfterCharacters`, `setCardNameVersion`.
  - `engine/turns.ts` — turn/phase flow, draw phase variants, delayed-trick judgments, `startTurn`/`endTurn`.
  - `engine/view.ts` — `createPublicGameState(state, viewerId)` per-viewer redaction. (`publicState` is a `@deprecated` alias the server still calls.)
  - `engine/handlers/character-skills.ts` — `CHARACTER_SKILLS` + `hasCharacterSkill` + `SKILL_EVENT_HANDLERS` + `dispatchGameEvent` and every player-triggered skill handler.
  - `engine/handlers/combat.ts` — basic cards: attack/dodge/heal, damage, dying rescue, death resolution, duels.
  - `engine/handlers/equipment.ts` — equipment cards: passives, weapon effect handlers (twin swords, snake spear, zhangba, kirin, ice sword…), armor judgment.
  - `engine/handlers/tricks.ts` — instant/targeted/delayed/mass tricks, harvest, coerce, and the negate (คงกระพันชาตรี) pipeline.
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

## 5. QA God Mode / Dev Sandbox
Dev-only tooling for driving a game into arbitrary states by hand instead of playing through them, so testers can reach and re-test any board/skill/judgment situation on demand. Two independent guards keep it out of production, so a misconfigured build can't leak it:
- Backend: the sandbox is **opt-in** — `registerDevSandbox` is called from `server.ts` only when `NODE_ENV !== 'production'` **and** `DEV_SANDBOX === '1'` (the `@wtk/server` dev script sets it via cross-env). Forgetting the env means OFF, not on. Frontend: `DebugSandboxPanel` is mounted only behind `process.env.NODE_ENV !== "production"`.
- Both also refuse a second time internally — `registerDevSandbox` re-checks both conditions and returns, and `DebugSandboxPanel` renders `null` in production — so even a stray import can't activate them. Both sides of the guard are covered by gateway tests (`server.test.ts`).

**Backend:**
- `packages/game/src/engine/handlers/dev-sandbox.ts` — pure `GameState` mutations (`devSpawnCard`, `devSetCharacter`, `devSetHp`, `devInsertTopDeck`, `devForceJudgment`, `devSnapshot`, `devLoadSnapshot`). No env access here; every mutation ends in `synchronizeGameState` so draw/discard mirrors and skill reconciliation stay coherent before broadcast.
- `apps/server/src/dev-sandbox.ts` — the socket layer. `registerDevSandbox(deps)` is called once from `apps/server/src/server.ts` behind the `NODE_ENV` + `DEV_SANDBOX=1` guard and wires `dev:*` handlers (below) onto every connecting socket. It also exports `isTimerFrozen(gameId)` and `devAutoTick(game)`, which `server.ts`'s `refreshTimeout` and `emitGame` call unconditionally on every game — until `registerDevSandbox` actually runs, the module's internal `deps` stays `null`, so both are no-ops and a production server is unaffected even though the imports are always present.

**Frontend:**
- `apps/web/components/DebugSandboxPanel.tsx` — a floating, draggable, collapsible panel (position/open-state persisted to `localStorage`). Talks to the server purely through `dev:*` emits on the socket it's handed.
- Mounted in `apps/web/app/page.tsx` (the online client) next to the encyclopedia drawer, behind `process.env.NODE_ENV !== "production"`, passed the live `game`, `gameId`, and `socket`.

**The 7 QA capabilities** (each maps to a `dev:*` socket event — see `dev-sandbox.ts` in both packages before building new debug tooling, this likely already covers it):
1. **Hot-seat control** (`dev:switch-control`) — rebinds the current socket to another seat, so one tester plays every seat from one tab.
2. **Card spawning** (`dev:spawn-card`) — gives any card (by id or name) to a target's hand or equipment slot; pulls a real physical copy from the deck/discard first, only clones a fresh id if none exists.
3. **Character morphing** (`dev:set-character`) — swaps a player's character mid-game, resets HP/max HP and reseeds loss-tracking so the swap itself can't trigger loss-skill draws; skills resolve live from `CHARACTER_SKILLS[character.id]`.
4. **Timer freeze** (`dev:toggle-freeze-timer`) — suspends a game's decision countdown; `refreshTimeout` checks `isTimerFrozen(game.id)` first and, when frozen, clears any running timer and broadcasts `responseDeadline: null`.
5. **Deck/judgment rigging** (`dev:insert-top-deck`, `dev:force-judgment`) — places a chosen card, or an exact suit+rank, on top of the draw pile so the next draw or judgment reveal (Lightning, Indulgence, Guicai fortune, armor, retaliate…) is deterministic.
6. **Dummy auto-pass** (`dev:set-dummy-mode`) — seats with no live socket attached auto-decline pending responses or auto-advance their own turn (draw → discard → end), one step per `emitGame` broadcast via `devAutoTick`, so a solo tester can watch a full table play out.
7. **State snapshotting** (`dev:export-snapshot` / `dev:load-snapshot`) — exports the full authoritative `GameState` as JSON (via ack callback, copied to clipboard) and reloads one in place, preserving room identity (`id`/`hostId`) so server timers and closures holding the old object reference stay valid.
