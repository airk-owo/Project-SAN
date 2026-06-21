# Current System Status

## Current Milestone

Current Phase:
Pre-Gameplay Foundation

Status:
Lobby, seating, role assignment, character selection, and base turn flow exist.

Next Major Goal:
Complete the first fully playable match using only:

- Attack
- Dodge
- Heal

before implementing advanced cards and character skills.

---

## Definition of Playable Prototype

A match is considered playable when:

- Players can join a room
- Select seats
- Ready up
- Receive roles
- Select characters
- Receive cards
- Take turns
- Use Attack
- Respond with Dodge
- Use Heal
- Lose HP
- Die
- Reach a valid win condition

Advanced cards and skills are not required.

---

## Completed

- Source-data import for cards, roles, turn rules, characters, and authoritative DOCX setup rules.
- Server-authoritative Socket.io room and game state.
- Spectator-first room entry, ten server-validated seats, ready state, random seat, return-to-spectator, leave-room, and reconnect identity.
- Client-side visual seat rotation while preserving real seat order on the server.
- Role dealing, role reveal, emperor character choice, other character choice, initial draw, and direction setup.
- Chat, game log, card/character details, spectator-safe state projection, hand-limit discard flow, and manual turn draw.
- Base automatic flows for attack, dodge, heal, damage, response window, and turn progression.
- Scalable card metadata: card type, effect parameters, trigger timing, equipment slot, and response-window declaration.

---

## Incomplete / Prototype Behavior

- Most trick, delayed trick, armor, mount, and weapon effects are documented but not yet resolved automatically.
- Equipment is stored but its individual passive/trigger behavior is not fully applied.
- Character skill event subscribers are prepared architecturally but not implemented per character.
- Dying/heal response queue, distance calculation, judgment area, and full turn subphases need completion.
- Supabase Google Auth, persistence, statistics, profiles, replay, room passwords, and deployment setup are incomplete.
- No automated test suite or end-to-end multiplayer test harness yet.