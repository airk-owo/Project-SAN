# Current System Status

Last verified: 2026-07-08 (`npm test -w @wtk/game` → 308/308 passing across 86 suites; `npm run check` → clean in all three workspaces)

## Current Milestone

Current Phase:
Core Gameplay Complete → Hardening & Persistence

The original "first playable match with Attack/Dodge/Heal" goal — and everything that was planned after it — is done. A full match with equipment, tricks, delayed tricks, duels, judgment, and all character skills is playable online (server-authoritative) and offline (local hotseat).

Next Major Goal:
Take the finished game loop to real players: enable persistence/auth in a deployed environment, and harden the multiplayer experience (reconnect UX, room browser, moderation).

---

## Completed

- Source-data import for cards, roles, turn rules, characters, and authoritative DOCX setup rules.
- Server-authoritative Socket.io room and game state; viewer-safe per-player state projection.
- Spectator-first room entry, ten server-validated seats, ready state, random seat, return-to-spectator, leave-room, and reconnect identity.
- Client-side visual seat rotation while preserving real seat order on the server.
- Role dealing, role reveal, emperor character choice, other character choice, initial draw, and direction setup.
- Chat, game log, card/character details, hand-limit discard flow, and turn draw.
- Full combat flow: attack, dodge, heal, damage, dying/heal response queue, response windows, multi-attack, duel, negate chains.
- Equipment slots with real passive/trigger behavior (weapons, armor, mounts) and distance calculation.
- Tricks and delayed tricks with judgment area and full turn subphases.
- **All 27 character skills (CHAR001–027) implemented and tested** — active, reactive (event handlers), suit-conversion, loss-triggered, and ally-assist skills. See `packages/game/src/engine/handlers/character-skills.ts`.
- Engine modularized: `packages/game/src/engine/` (state, actions, setup, turns, view, handlers/) behind a thin `index.ts` router.
- Automated engine test suite: 308 tests / 86 suites (`npm test -w @wtk/game`, Node test runner via tsx).
- QA God Mode dev sandbox (hot-seat control, card spawning, character morphing, timer freeze, deck/judgment rigging, state snapshot/load) — dev-only, double-guarded. See `ARCHITECTURE.md` §5.
- Supabase Google Auth + player statistics **built but feature-flagged OFF by default** (web `NEXT_PUBLIC_FEATURE_AUTH`, server `FEATURE_AUTH_STATS`; enable procedure in `docs/auth-setup.md`).

---

## Incomplete / Not Started

- Auth/stats feature has never been enabled against a real Supabase project (flag off; needs the `docs/auth-setup.md` procedure end-to-end).
- Real deployment (Dockerfile and `.env.example` exist; no live environment).
- Room browser realtime refresh, room passwords, host moderation tools.
- Reconnect UX polish.
- Replay system and match-history UI.
- No automated tests for `apps/web` / `apps/server`; no end-to-end multiplayer test harness (manual testing via the QA sandbox).
- `basic-combat.scenarios.ts` standalone harness is not wired into `npm test`.
