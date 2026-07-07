# Recommended next tasks

(Reviewed 2026-07-08 — items 1–6 of the previous backlog are done: engine tests, equipment + distance, parameterized effects, response queues, judgment/delayed tricks, and all 27 character skills. See `docs/current-status.md`.)

1. Enable and verify the auth/stats feature end-to-end against a real Supabase project (`docs/auth-setup.md`), then persist rooms, games, and logs.
2. Deploy a real environment (Docker) and playtest online with real players.
3. Room browser realtime refresh, room passwords, and host moderation.
4. Reconnect UX polish (mid-game rejoin experience).
5. Add automated coverage for `apps/server` socket handlers (seat/turn/skill flows) — the engine is tested, the gateway is not.
6. Replay/statistics UI and match history — only after persistence (task 1) is live.

# Not Yet

Do not spend significant effort on:

- Ranked mode
- Expansion packs
- Bot players

until online play with persistence is live and stable.
