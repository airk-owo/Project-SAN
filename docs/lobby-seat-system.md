# Lobby, seats, spectator, and reconnect model

The room starts spectator-first. A member becomes a player candidate only after the server assigns one of ten fixed seat indexes. `seatIndex` is the authoritative clockwise order and remains unchanged by client rendering.

## Member state

- `Player`: `id`, `username`, `seatIndex` (1–10), `ready`, `connectionStatus`, `joinedAt`, `lastSeenAt` plus active-game state.
- `Spectator`: the same identity/connection fields without a seat or ready flag.
- `hostId` is independent of role and seat; the host may start only when all seated players are ready.

## Server actions

`room:join`, `seat:select`, `seat:random`, `seat:spectate`, `room:leave`, `player:ready`, and `game:start` validate membership and room phase on the server. A stable `userId` is kept in browser local storage; joining with it after reconnect restores the existing member and reserved seat.

## Disconnect policy

Seated players are marked `disconnected`; their seat and active-game state remain reserved. Spectators remain visible as disconnected members. Host kick, bot takeover, and active-game defeat-on-leave remain future policies.

## Visual rotation

The client rotates only seat positions: its own `seatIndex` is rendered at the bottom, while the server continues to use real ascending seat indexes for game order and future distance calculation. Spectators use seat 1 as the visual anchor.
