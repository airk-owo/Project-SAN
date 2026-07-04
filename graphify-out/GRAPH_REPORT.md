# Graph Report - H:\WTK project\Project-SAN  (2026-07-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 681 nodes · 2235 edges · 40 communities (38 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6133ae4a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_basic-combat.scenarios.ts|basic-combat.scenarios.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_import-cards.mjs|import-cards.mjs]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_beginPlayAfterCharacters|beginPlayAfterCharacters]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_LobbyTable.tsx|LobbyTable.tsx]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_build-cards.js|build-cards.js]]
- [[_COMMUNITY_useDiscardTwoAsAttack|useDiscardTwoAsAttack]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_createSeatedPlayer|createSeatedPlayer]]
- [[_COMMUNITY_dealRoles|dealRoles]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_createGame|createGame]]
- [[_COMMUNITY_negate.test.ts|negate.test.ts]]
- [[_COMMUNITY_trick-negate.test.ts|trick-negate.test.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_coerce.test.ts|coerce.test.ts]]
- [[_COMMUNITY_delayed-tricks.test.ts|delayed-tricks.test.ts]]
- [[_COMMUNITY_snake-spear.test.ts|snake-spear.test.ts]]
- [[_COMMUNITY_duel.test.ts|duel.test.ts]]
- [[_COMMUNITY_resolvePlayerDeath|resolvePlayerDeath]]
- [[_COMMUNITY_multi-attack.test.ts|multi-attack.test.ts]]
- [[_COMMUNITY_twin-swords.test.ts|twin-swords.test.ts]]
- [[_COMMUNITY_GameState|GameState]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_ไพ่ (Cards Document)|ไพ่ (Cards Document)]]
- [[_COMMUNITY_next.config.mjs|next.config.mjs]]
- [[_COMMUNITY_dispatchGameEvent|dispatchGameEvent]]

## God Nodes (most connected - your core abstractions)
1. `getPlayerById()` - 102 edges
2. `logAction()` - 89 edges
3. `characterName()` - 85 edges
4. `synchronizeGameState()` - 74 edges
5. `LocalGamePage()` - 44 edges
6. `playAttack()` - 42 edges
7. `createSeatedPlayer()` - 41 edges
8. `createGame()` - 40 edges
9. `hasCharacterSkill()` - 37 edges
10. `findHandCard()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `member()` --indirect_call--> `now()`  [INFERRED]
  packages/game/src/basic-combat.scenarios.ts → apps/server/src/index.ts
- `scenarioImmediateTricks()` --indirect_call--> `now()`  [INFERRED]
  packages/game/src/basic-combat.scenarios.ts → apps/server/src/index.ts
- `scenarioPublicStatePrivacy()` --indirect_call--> `now()`  [INFERRED]
  packages/game/src/basic-combat.scenarios.ts → apps/server/src/index.ts
- `emitGame()` --calls--> `getBaseDistanceBetweenPlayers()`  [EXTRACTED]
  apps/server/src/index.ts → packages/game/src/index.ts
- `emitGame()` --calls--> `publicState`  [EXTRACTED]
  apps/server/src/index.ts → packages/game/src/index.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Card System Assets** — source_ไพ่_doc, source_ไพ่หลบโจมตีเสบียง_doc, source_image_bg_img [INFERRED 0.70]

## Communities (40 total, 2 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.08
Nodes (115): ActiveTimeout, allMembers(), app, cards, characters, connections, DECISION_SECONDS, DecisionKind (+107 more)

### Community 1 - "index.ts"
Cohesion: 0.03
Nodes (68): applyClassicCardNames(), areOppositeGenders(), CARD_CONVERSIONS, CardInstance, CardNameVersion, CardType, CardZone, CHARACTER_SKILLS (+60 more)

### Community 2 - "basic-combat.scenarios.ts"
Cohesion: 0.15
Nodes (56): now(), card(), character(), combatState(), discardTargetCard(), distanceState(), drawState(), duelCard() (+48 more)

### Community 3 - "page.tsx"
Cohesion: 0.08
Nodes (36): canAutoEndTurn(), Card, CARD_INFO, CardFace(), cardInfo(), cardTypeLabel(), Character, charName() (+28 more)

### Community 4 - "page.tsx"
Cohesion: 0.10
Nodes (36): card(), CARD_INFO, cardInfo(), character(), characterName(), createMockGameState(), discardTargetCard(), duelCard() (+28 more)

### Community 5 - "import-cards.mjs"
Cohesion: 0.10
Nodes (18): allowedCardTypes, allowedSlots, allowedTiming, authoritativeSetup, byName, cardImageAlias, cards, characterData (+10 more)

### Community 6 - "devDependencies"
Cohesion: 0.10
Nodes (20): dependencies, next, react, react-dom, socket.io-client, @supabase/supabase-js, devDependencies, autoprefixer (+12 more)

### Community 7 - "beginPlayAfterCharacters"
Cohesion: 0.16
Nodes (17): clearNegateWindow(), passNegate(), passNegate(), harvestCard(), makeCard(), makeCharacter(), makeGame(), passNegate() (+9 more)

### Community 8 - "package.json"
Cohesion: 0.11
Nodes (18): dependencies, cors, dotenv, express, socket.io, @wtk/game, devDependencies, tsx (+10 more)

### Community 9 - "LobbyTable.tsx"
Cohesion: 0.15
Nodes (13): LastCard, Props, Props, ReadyPanel(), hearts(), Props, SeatButton(), TableCharacter (+5 more)

### Community 10 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 11 - "build-cards.js"
Cohesion: 0.14
Nodes (17): BASIC, basicCards, cards, fs, loadAndConvert(), makeCard(), NAME_KEY, otherCards (+9 more)

### Community 12 - "useDiscardTwoAsAttack"
Cohesion: 0.15
Nodes (17): assertForcedAttackTarget(), attackDamageBonus(), attackDodgesRequired(), forcedAttackTargets(), hasDamageDestroyTargetMount(), hasDiscardTwoAsAttack(), hasLastHandMultiTargetAttack(), hasReplaceDamageWithDiscardTwo() (+9 more)

### Community 13 - "page.tsx"
Cohesion: 0.15
Nodes (10): chatMessages, getDensity(), getTableEdgePosition(), hand, logs, MockCard, MockGamePage(), MockPlayer (+2 more)

### Community 14 - "createSeatedPlayer"
Cohesion: 0.21
Nodes (10): createEmptyEquipmentSlots(), createSeatedPlayer(), Spectator, allMembers(), selectRandomSeat(), selectSeat(), assignCharacters(), makeCharacter() (+2 more)

### Community 15 - "dealRoles"
Cohesion: 0.23
Nodes (14): dealEmperorOptions(), dealOtherCharacterOptions(), dealRoles(), RoleComposition, selectCharacter(), shuffled(), CAOCAO, character() (+6 more)

### Community 16 - "scripts"
Cohesion: 0.17
Nodes (11): devDependencies, concurrently, name, private, scripts, check, dev, import:cards (+3 more)

### Community 17 - "createGame"
Cohesion: 0.29
Nodes (11): character(), makeGame(), spectator(), attackCard(), attackDeclined(), iceSword(), makeCard(), makeCharacter() (+3 more)

### Community 18 - "negate.test.ts"
Cohesion: 0.27
Nodes (11): draw(), drawForTurn(), attackCard(), dodgeCard(), drawCard(), healAllCard(), makeCard(), makeCharacter() (+3 more)

### Community 19 - "trick-negate.test.ts"
Cohesion: 0.33
Nodes (10): attackCard(), indulgence(), lightning(), makeCard(), makeCharacter(), makeGame(), negateCard(), negateWith() (+2 more)

### Community 20 - "package.json"
Cohesion: 0.20
Nodes (9): devDependencies, typescript, exports, name, scripts, check, test, type (+1 more)

### Community 21 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, strict, target, include

### Community 22 - "coerce.test.ts"
Cohesion: 0.47
Nodes (8): attackCard(), coerceCard(), dodgeCard(), makeCard(), makeCharacter(), makeGame(), spectator(), weapon()

### Community 23 - "delayed-tricks.test.ts"
Cohesion: 0.36
Nodes (8): indulgence(), lightning(), makeCard(), makeCharacter(), makePlayingGame(), plain(), spectator(), Character

### Community 24 - "snake-spear.test.ts"
Cohesion: 0.39
Nodes (8): dodgeCard(), handCard(), makeCard(), makeCharacter(), makePlayingGame(), renwangShield(), snakeSpear(), spectator()

### Community 25 - "duel.test.ts"
Cohesion: 0.39
Nodes (7): attackCard(), character(), duelCard(), makeCard(), makeGame(), spectator(), Card

### Community 26 - "resolvePlayerDeath"
Cohesion: 0.25
Nodes (8): checkWinCondition(), discardPlayerZones(), finishGame(), getAlivePlayersInSeatOrder(), getNextAlivePlayer(), getPlayersInSeatOrder(), massQueue(), resolvePlayerDeath()

### Community 27 - "multi-attack.test.ts"
Cohesion: 0.50
Nodes (7): attackCard(), dodgeCard(), makeCard(), makeCharacter(), makeGame(), spectator(), zhangbaSpear()

### Community 28 - "twin-swords.test.ts"
Cohesion: 0.50
Nodes (7): attackCard(), dodgeCard(), makeCard(), makeCharacter(), makeGame(), spectator(), twinSwords()

### Community 29 - "GameState"
Cohesion: 0.43
Nodes (5): GameState, allMembers(), handleDisconnect(), handleJoin(), handleLeave()

### Community 30 - "compilerOptions"
Cohesion: 0.29
Nodes (6): compilerOptions, module, moduleResolution, noEmit, strict, target

### Community 32 - "ไพ่ (Cards Document)"
Cohesion: 0.67
Nodes (3): Background Image, ไพ่ (Cards Document), ไพ่หลบโจมตีเสบียง (Evade Supply Attack Card Document)

## Knowledge Gaps
- **218 isolated node(s):** `name`, `private`, `type`, `dev`, `start` (+213 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `card()` connect `page.tsx` to `page.tsx`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `Home()` connect `page.tsx` to `page.tsx`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `createSeatedPlayer()` connect `createSeatedPlayer` to `index.ts`, `index.ts`, `basic-combat.scenarios.ts`, `page.tsx`, `beginPlayAfterCharacters`, `dealRoles`, `createGame`, `negate.test.ts`, `trick-negate.test.ts`, `coerce.test.ts`, `delayed-tricks.test.ts`, `snake-spear.test.ts`, `duel.test.ts`, `multi-attack.test.ts`, `twin-swords.test.ts`, `GameState`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _218 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07966400216772795 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.028169014084507043 - nodes in this community are weakly interconnected._
- **Should `basic-combat.scenarios.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14974937343358397 - nodes in this community are weakly interconnected._