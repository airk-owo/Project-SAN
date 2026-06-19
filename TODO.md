# Source-data TODO

- [x] Import character name, id, HP, faction and skill descriptions from `source/07_characters.csv`.
- [x] Import exact role composition and 6/8-player voting rules.
- [x] Import initial-hand, first-turn and emperor-HP rules from `source/คู่มือ WTK.docx` (authoritative).
- [ ] Map card artwork PDFs to imported card IDs.
- [ ] Add verified `backend_effect_key` values and resolver parameters for the remaining 29 card definitions. V2 currently automates only `attack`, `dodge`, and `heal`, which are the only verified keys in source data.
- [ ] Add verified machine-readable trigger/effect keys for all 43 character skills before automatic skill resolution is enabled.
- [ ] Add Supabase Google Auth callback and production session validation to Socket.io.
