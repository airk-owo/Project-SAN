# Recommended next tasks

1. Add focused unit tests for seat validation, reconnect preservation, role dealing, and viewer-safe state.
2. Implement equipment slots and real distance calculation from `card_type`/`equipment_slot` metadata.
3. Implement simple parameterized effects first: `draw_cards`, `heal_all_living`, then equipment replacement.
4. Build reusable response queues for mass attacks, duel, and negate chains.
5. Add decision area and judgment flow for delayed tricks.
6. Implement character skill event subscribers in small, verified batches.
7. Complete Supabase authentication and persist rooms, games, logs, profiles, and statistics.
8. Add room browser refresh/realtime updates, passwords, host moderation, and reconnect UX polish.
9. Add replay/statistics and expansion pack loading only after core rule coverage is stable.

# Not Yet

Do not spend significant effort on:

- Replay system
- Statistics
- Match history
- Ranked mode
- Expansion packs
- Bot players
- Cosmetic UI polish

until core gameplay rules are complete.