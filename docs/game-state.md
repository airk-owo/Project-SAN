# Game State Model

`packages/game` owns the serializable state for a WTK match. The server is the
only writer. Clients receive a viewer-safe projection and send intent, never a
replacement game state.

## Canonical match fields

`GameState` has a persistence-oriented layer:

- Match identity: `gameId`, `roomId`, `status`, `createdAt`, and `updatedAt`.
- Membership: `players` and `spectators`.
- Turn data: `turn`, including the authoritative active player, direction,
  phase, turn number, and attack count.
- Card locations: `drawPile`, `discardPile`, player hands, equipment slots,
  decision areas, and `currentAction`.
- Interaction state: `responseWindow` and `chat`.
- Audit data: `log`.

All timestamps are ISO strings and all IDs are strings, so the object can be
serialized as JSON without custom encoders.

The playable prototype still contains compatibility fields such as `phase`,
`deck`, `discard`, and `pendingAction`. `synchronizeGameState` refreshes the
canonical fields from those fields before a public state is emitted or a match
is persisted. This permits an incremental migration without changing existing
gameplay behavior.

## Card locations and current action

`discardPile` contains cards whose effects have finished resolving. It is a
history of resolved cards; its top card is returned by `getTopDiscardCard`.

When the draw pile is empty, `reshuffleDiscardIntoDrawPile` keeps that visible
top discard card in place and shuffles every older discarded card into a new
draw pile. This preserves the public discard-pile reference used by the table
UI. If there are no recyclable cards, drawing returns as many cards as possible
and writes an empty-pile log entry instead of failing. The current shuffle uses
randomness; deterministic seeded shuffling is a future replay requirement.

`currentAction` is separate. It represents the card/action currently being
declared or resolved, including actor, targets, effect key, and status. A
`ResponseWindow` may refer to that action while it waits for players to answer.
In the final resolver flow, a played card moves from `currentAction` to
`discardPile` only after resolution.

## Account identity and character identity

`PlayerIdentity` is the real account identity: `userId`, `username`, and an
optional `displayName`. It supports lobby, chat, moderation, reconnect, and
host tools.

`CharacterState` is the in-game identity. Game logs should use character names
when a character has been selected, while chat should use `username`. This
keeps game actions readable without losing the ability to identify the real
account behind a seat.

## Hidden information and public state

Use `createPublicGameState(gameState, viewerId)` at the server boundary. It:

- exposes a player's own hand only to that player;
- replaces every other hand with an empty list plus `handCount`;
- exposes only the draw-pile count, never its card contents;
- hides roles unless they belong to the viewer or `roleRevealed` is true;
- hides character-choice options from other players and spectators.

Spectators therefore receive public board state but no private hands, role
cards, or character-selection choices.

The runtime projection removes `drawPile` before returning the object; it adds
`drawPileCount` and a length-only legacy `deck` view instead. The discard pile
remains public. Response records are also sanitized so a viewer sees responder
status but never a response card's `cardInstanceId`.

## Seat order

`seatIndex` remains server order. `getPlayersInSeatOrder` sorts by that value.
The web client may rotate the rendered table to put its viewer at the bottom,
but that rotation must never change the server state. Turn order, distance, and
future effect resolution all use the real seat order.

## Distance

`getAlivePlayersInSeatOrder` removes defeated players, then sorts the remaining
players by their authoritative `seatIndex`. `getBaseDistanceBetweenPlayers`
uses the shorter of the two circular paths through that list. Consequently,
dead players never add to distance and client-side visual rotation has no
effect on range.

`getAttackRange` currently returns `1`, and `canTargetWithAttack` validates a
living, non-self target against that range. Weapon range and offensive or
defensive mount modifiers are intentionally TODOs at this boundary.

## Equipment slots

Runtime players store equipment in one `EquipmentSlots<Card>` object rather
than an array. `playEquipment` maps card metadata as follows:

| `card_type` / `equipment_slot` | Runtime slot |
| --- | --- |
| `weapon` | `weapon` |
| `armor` | `armor` |
| `offensive_mount` | `offensiveMount` |
| `defensive_mount` | `defensiveMount` |

Equipping replaces only the matching slot. If the slot already contains a
card, that card moves to the discard pile before the new card is stored. This
task deliberately does not apply weapon range, armor, or mount effects; the
slot data is ready for those resolvers later.

## Helpers

- `createEmptyEquipmentSlots`
- `getPlayerById`
- `getAlivePlayers`
- `getPlayersInSeatOrder`
- `getTopDiscardCard`
- `getCurrentActionSummary`
- `synchronizeGameState`
- `createPublicGameState`

## Current basic-combat migration

The Attack, Dodge, and Heal flow now creates `currentAction` and
`responseWindow` directly. An Attack remains in `currentAction` while its
target decides whether to Dodge; it moves to the discard pile only when the
action resolves. The legacy `pendingAction` remains synchronized solely for
the existing Socket/UI payload while that payload is migrated.

## Basic turn phases

The current prototype turn cycle is `draw → play → discard → end`. `startTurn`
marks the next living player active and opens draw phase. `drawCards` draws up
to two cards without crashing if the pile is empty, then enters play phase.
`canPlayerAct` and `canPlayCardNow` restrict Attack and Heal to the active
player during play phase; Dodge is restricted to its response window.

`endTurn` blocks while a response is open, checks the hand limit against current
HP, and starts the next alive player in authoritative seat order. The prototype
does not yet provide a complete choice UI for discards; callers can use the
existing hand-limit discard helper before ending the turn.

## Dying rescue window

`applyDamage` does not immediately defeat a player at 0 HP. It opens a
`ResponseWindow` of type `dying_heal` with `dyingPlayerId` and a responder queue.
The dying player answers first, followed by other living players in real seat
order. Each responder may use `Heal` on the dying player or call
`declineResponse`.

One successful Heal closes the window and keeps the player alive at at least
1 HP. If every eligible player declines, the window closes and that player is
marked dead. Win conditions, role rewards, and moving the turn when the active
player dies remain deliberately out of scope.

## TODO: complete the runtime migration

Other cards still use the compatibility `deck`/`discard` fields. A later
focused refactor should make `drawPile`, `discardPile`,
`PlayerState.equipment`, and `decisionArea` the direct runtime source of truth
for every resolver. Add save/restore and viewer-safe projection tests before
introducing persistence.
