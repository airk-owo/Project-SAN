# Recommended next tasks

(Reviewed 2026-07-08 — items 1–6 of the previous backlog are done: engine tests, equipment + distance, parameterized effects, response queues, judgment/delayed tricks, and all 27 character skills. See `docs/current-status.md`.)

1. Enable and verify the auth/stats feature end-to-end against a real Supabase project (`docs/auth-setup.md`), then persist rooms, games, and logs.
2. Deploy a real environment (Docker) and playtest online with real players.
3. Room browser realtime refresh, room passwords (or server-generated room codes — see security backlog in `docs/security-checklist.md` §4), and host moderation.
4. Reconnect UX polish (mid-game rejoin experience).
5. Extend the gateway test suite (`apps/server/src/server.test.ts`) into in-game flows: start a 4-player match with the QA freeze-timer, cover turn/skill events end-to-end. (Lobby, identity, and hardening are already covered; CI runs the suite on every push.)
6. Replay/statistics UI and match history — only after persistence (task 1) is live.

# Not Yet

Do not spend significant effort on:

- Ranked mode
- Expansion packs
- Bot players

until online play with persistence is live and stable.
