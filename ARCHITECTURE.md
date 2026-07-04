# ARCHITECTURE

WTK Online — real-time multiplayer hidden-role card game (San Guo Sha style, Thai UI). Server-authoritative.

## 1. Tech Stack
- **Monorepo:** npm workspaces (`apps/*`, `packages/*`).
- **Backend:** Node.js 22 + TypeScript (ESM, run via `tsx`) + Express 4 + Socket.io 4 (in-memory state).
- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS 3 + socket.io-client.
- **Auth/DB:** Supabase (Postgres + Google OAuth).
- **Engine:** Pure TS package `@wtk/game` (framework-agnostic).
- **Deploy:** Docker (`node:22-slim`).

## 2. Directory Tree
- `apps/server/` — Realtime server (socket handlers in `src/index.ts`).
- `apps/web/` — Next.js client (lobby, seating, gameplay UI).
- `packages/game/` — Pure TS rules engine (state, card/skill resolvers, tests).
- `data/generated/` — Boot-loaded runtime JSONs (cards, characters, rules). Do not edit.
- `source/` — Content source of truth (CSV, DOCX, art, fonts).
- `scripts/` — Pipeline: `source/` -> `data/generated/`.
- `supabase/` — Postgres migrations (profiles, sessions, stats, RLS).
- `docs/` — Specifications, design notes, and troubleshooting.

## 3. Core Modules
- `packages/game/src/index.ts` — Engine core: `GameState`, deck dealing, turn phases, card/skill resolvers, and `createPublicGameState` (hides opponent hands).
- `apps/server/src/index.ts` — Socket gateway: manages `games` Map, auth (`requireUser`), ~80 event-to-engine handlers, and 15s/60s auto-skip timers.
- `apps/web/app/page.tsx` — Next.js root view: owns socket connection and screens (lobby to gameplay). Renders `game:state`.
- `apps/web/lib/supabase.ts` — Supabase client for auth and persistent stats.
- `data/generated/rules.json` — Initial roles, hand sizes, and setup rules.
- `supabase/migrations/0001_initial.sql` — DB schema (`profiles`, `game_sessions`, `game_participants`).

## 4. Data Flow
- **Boot:** Server loads `data/generated/*.json` into memory.
- **Join:** Client emits `room:join` -> Server authenticates and maps user to a `GameState` in `games` Map.
- **Sync:** `emitGame` triggers -> `createPublicGameState` filters private data per player -> Broadcasts `game:state`.
- **Action:** Player emits action (`card:play`, `skill:*`) -> `requireUser` auth -> `@wtk/game` mutates state -> Server re-broadcasts via `emitGame`.
- **Timeouts:** Server timer auto-declines actions if player idles (15s/60s).
- **DB Path:** Client calls Supabase directly for auth/stats. Core game state remains in-memory.
