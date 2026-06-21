# WTK project architecture

## Root folders

| Path | Purpose |
| --- | --- |
| `apps/` | Runnable applications: browser client and authoritative Socket.io server. |
| `packages/game/` | Shared game-domain types, game state, card resolver primitives, turn flow, and server-authoritative rule helpers. |
| `source/` | Human-maintained source of truth for WTK cards, rules, roles, characters, fonts, and artwork. |
| `data/generated/` | Generated JSON consumed at runtime. Never hand-edit; regenerate with `npm run import:game-data`. |
| `scripts/` | Import tools that transform source CSV/DOCX files into generated data. |
| `supabase/` | Database migrations and future Supabase-related configuration. |
| `docs/` | Architecture, game resolver contracts, room/seat model, current status, and implementation roadmap. |

## Applications

### `apps/web`

- `app/page.tsx`: page-level client state, Socket.io connection, modal state, and game actions.
- `components/`: focused presentational/interaction components for lobby table seating and readiness.
- `lib/tableRotation.ts`: pure client-side seat rotation. It never changes real seat order.
- `lib/supabase.ts`: Supabase client setup.
- `public/assets/`: copied browser-safe fonts and background assets.

### `apps/server`

`src/index.ts` owns room membership, spectator/seat validation, reconnect mapping, Socket.io actions, and state broadcasts. Clients request actions only; server validates and mutates state.

## Domain and data flow

1. Source CSV/DOCX files are imported by scripts.
2. Generated JSON is loaded by the server on start.
3. The server creates/updates `GameState` in `packages/game`.
4. A viewer-safe state is sent to each player or spectator.
5. The web app renders its own seat at the bottom using `tableRotation`; game order remains based on real seat indexes.

## Extension boundaries

- Card balance/effect metadata belongs in `source/02_card_definitions.csv`.
- Card resolver contracts belong in `docs/card-effect-logic.md` and `packages/game`.
- Character skills should register event subscribers rather than modify card resolver implementations.
- New UI should be added as components before growing `app/page.tsx`.
