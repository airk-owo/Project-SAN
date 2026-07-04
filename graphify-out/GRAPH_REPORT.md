# Graph Report - Project-SAN  (2026-07-05)

## Corpus Check
- 86 files · ~869,288 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 822 nodes · 2687 edges · 55 communities (50 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2d3a5fcb`
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
- [[_COMMUNITY_Folder Responsibilities|Folder Responsibilities]]
- [[_COMMUNITY_Game State Model|Game State Model]]
- [[_COMMUNITY_WTK card effect logic|WTK card effect logic]]
- [[_COMMUNITY_1. หน้าเว็บไม่มีสไตล์  UI หาย (CSS โหลดไม่ได้ 404 ในโหมด dev)|1. หน้าเว็บไม่มีสไตล์ / "UI หาย" (CSS โหลดไม่ได้ 404 ในโหมด dev)]]
- [[_COMMUNITY_WTK project architecture|WTK project architecture]]
- [[_COMMUNITY_Feature card description tooltip (hoverfocus)|Feature: card description tooltip (hover/focus)]]
- [[_COMMUNITY_Project-SAN · card data pipeline|Project-SAN · card data pipeline]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_Current System Status|Current System Status]]
- [[_COMMUNITY_Lobby, seats, spectator, and reconnect model|Lobby, seats, spectator, and reconnect model]]
- [[_COMMUNITY_Fix mass-trick demo responses use the correct card type|Fix: mass-trick demo responses use the correct card type]]
- [[_COMMUNITY_next-tasks|next-tasks.md]]
- [[_COMMUNITY_CLAUDE|CLAUDE.md]]
- [[_COMMUNITY_architecture-decisions|architecture-decisions.md]]
- [[_COMMUNITY_TODO|TODO.md]]

## God Nodes (most connected - your core abstractions)
1. `getPlayerById()` - 108 edges
2. `logAction()` - 96 edges
3. `characterName()` - 92 edges
4. `synchronizeGameState()` - 80 edges
5. `playAttack()` - 45 edges
6. `LocalGamePage()` - 44 edges
7. `hasCharacterSkill()` - 42 edges
8. `createSeatedPlayer()` - 41 edges
9. `findHandCard()` - 41 edges
10. `createGame()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `member()` --indirect_call--> `now()`  [INFERRED]
  packages/game/src/basic-combat.scenarios.ts → apps/server/src/index.ts
- `scenarioImmediateTricks()` --indirect_call--> `now()`  [INFERRED]
  packages/game/src/basic-combat.scenarios.ts → apps/server/src/index.ts
- `scenarioPublicStatePrivacy()` --indirect_call--> `now()`  [INFERRED]
  packages/game/src/basic-combat.scenarios.ts → apps/server/src/index.ts
- `emitGame()` --calls--> `getBaseDistanceBetweenPlayers()`  [EXTRACTED]
  apps/server/src/index.ts → packages/game/src/engine/state.ts
- `emitGame()` --calls--> `publicState`  [EXTRACTED]
  apps/server/src/index.ts → packages/game/src/engine/view.ts

## Import Cycles
- 3-file cycle: `packages/game/src/engine/actions.ts -> packages/game/src/engine/handlers/combat.ts -> packages/game/src/engine/handlers/tricks.ts -> packages/game/src/engine/actions.ts`
- 3-file cycle: `packages/game/src/engine/handlers/character-skills.ts -> packages/game/src/engine/handlers/combat.ts -> packages/game/src/engine/handlers/tricks.ts -> packages/game/src/engine/handlers/character-skills.ts`
- 3-file cycle: `packages/game/src/engine/handlers/character-skills.ts -> packages/game/src/engine/handlers/combat.ts -> packages/game/src/engine/turns.ts -> packages/game/src/engine/handlers/character-skills.ts`
- 3-file cycle: `packages/game/src/engine/state.ts -> packages/game/src/engine/types.ts -> packages/game/src/engine/view.ts -> packages/game/src/engine/state.ts`
- 4-file cycle: `packages/game/src/engine/actions.ts -> packages/game/src/engine/handlers/combat.ts -> packages/game/src/engine/handlers/tricks.ts -> packages/game/src/engine/handlers/character-skills.ts -> packages/game/src/engine/actions.ts`
- 4-file cycle: `packages/game/src/engine/actions.ts -> packages/game/src/engine/handlers/combat.ts -> packages/game/src/engine/turns.ts -> packages/game/src/engine/handlers/character-skills.ts -> packages/game/src/engine/actions.ts`

## Hyperedges (group relationships)
- **Card System Assets** — source_ไพ่_doc, source_ไพ่หลบโจมตีเสบียง_doc, source_image_bg_img [INFERRED 0.70]

## Communities (55 total, 5 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.07
Nodes (134): ActiveTimeout, allMembers(), app, cards, characters, connections, DECISION_SECONDS, DecisionKind (+126 more)

### Community 1 - "index.ts"
Cohesion: 0.13
Nodes (30): card(), CARD_INFO, cardInfo(), character(), characterName(), createMockGameState(), discardTargetCard(), duelCard() (+22 more)

### Community 2 - "basic-combat.scenarios.ts"
Cohesion: 0.18
Nodes (46): now(), card(), character(), combatState(), discardTargetCard(), distanceState(), drawState(), duelCard() (+38 more)

### Community 3 - "page.tsx"
Cohesion: 0.08
Nodes (49): canAutoEndTurn(), CARD_INFO, cardInfo(), cardTypeLabel(), charName(), coarsePointer(), edgePosition(), hearts() (+41 more)

### Community 4 - "page.tsx"
Cohesion: 0.15
Nodes (36): createTargetedCardAction(), resolveTargetedCardAction(), assertForcedAttackTarget(), attackDamageBonus(), attackDodgesRequired(), forcedAttackTargets(), isImmuneToAttack(), canTargetWithAttack() (+28 more)

### Community 5 - "import-cards.mjs"
Cohesion: 0.10
Nodes (18): allowedCardTypes, allowedSlots, allowedTiming, authoritativeSetup, byName, cardImageAlias, cards, characterData (+10 more)

### Community 6 - "devDependencies"
Cohesion: 0.10
Nodes (20): dependencies, next, react, react-dom, socket.io-client, @supabase/supabase-js, devDependencies, autoprefixer (+12 more)

### Community 7 - "beginPlayAfterCharacters"
Cohesion: 0.18
Nodes (16): clearNegateWindow(), passNegate(), passNegate(), declineNegate(), dealRoles(), harvestCard(), makeCard(), makeCharacter() (+8 more)

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
Cohesion: 0.05
Nodes (38): CardType, CardZone, CharacterState, ChatMessage, ConnectionStatus, CurrentAction, EffectParams, EffectResolver (+30 more)

### Community 13 - "page.tsx"
Cohesion: 0.15
Nodes (10): chatMessages, getDensity(), getTableEdgePosition(), hand, logs, MockCard, MockGamePage(), MockPlayer (+2 more)

### Community 14 - "createSeatedPlayer"
Cohesion: 0.29
Nodes (7): character(), makeGame(), spectator(), createSeatedPlayer(), allMembers(), selectRandomSeat(), selectSeat()

### Community 15 - "dealRoles"
Cohesion: 0.14
Nodes (21): createGame(), dealEmperorOptions(), dealOtherCharacterOptions(), RoleComposition, selectCharacter(), setCardNameVersion(), createEmptyEquipmentSlots(), draw() (+13 more)

### Community 16 - "scripts"
Cohesion: 0.17
Nodes (11): devDependencies, concurrently, name, private, scripts, check, dev, import:cards (+3 more)

### Community 17 - "createGame"
Cohesion: 0.50
Nodes (7): attackCard(), attackDeclined(), iceSword(), makeCard(), makeCharacter(), makePlayingGame(), spectator()

### Community 18 - "negate.test.ts"
Cohesion: 0.36
Nodes (9): attackCard(), dodgeCard(), drawCard(), healAllCard(), makeCard(), makeCharacter(), makePlayingGame(), negateCard() (+1 more)

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
Cohesion: 0.43
Nodes (7): indulgence(), lightning(), makeCard(), makeCharacter(), makePlayingGame(), plain(), spectator()

### Community 24 - "snake-spear.test.ts"
Cohesion: 0.39
Nodes (8): dodgeCard(), handCard(), makeCard(), makeCharacter(), makePlayingGame(), renwangShield(), snakeSpear(), spectator()

### Community 25 - "duel.test.ts"
Cohesion: 0.43
Nodes (7): attackCard(), character(), duelCard(), makeCard(), makeGame(), spectator(), beginPlayAfterCharacters()

### Community 26 - "resolvePlayerDeath"
Cohesion: 0.18
Nodes (9): gameStatusFor(), getTopDiscardCard(), turnPhaseFor(), CardInstance, EquipmentSlots, GamePhase, GameStatus, HiddenHandSelection (+1 more)

### Community 27 - "multi-attack.test.ts"
Cohesion: 0.50
Nodes (7): attackCard(), dodgeCard(), makeCard(), makeCharacter(), makeGame(), spectator(), zhangbaSpear()

### Community 28 - "twin-swords.test.ts"
Cohesion: 0.50
Nodes (7): attackCard(), dodgeCard(), makeCard(), makeCharacter(), makeGame(), spectator(), twinSwords()

### Community 29 - "GameState"
Cohesion: 0.21
Nodes (10): GameState, Spectator, allMembers(), handleDisconnect(), handleJoin(), handleLeave(), assignCharacters(), makeCharacter() (+2 more)

### Community 30 - "compilerOptions"
Cohesion: 0.29
Nodes (6): compilerOptions, module, moduleResolution, noEmit, strict, target

### Community 32 - "ไพ่ (Cards Document)"
Cohesion: 0.67
Nodes (3): Background Image, ไพ่ (Cards Document), ไพ่หลบโจมตีเสบียง (Evade Supply Attack Card Document)

### Community 35 - "dispatchGameEvent"
Cohesion: 0.22
Nodes (8): ResponseRecord, ResponseWindow, applyClassicCardNames(), PublicCardView, PublicGameState, PublicPlayerState, PublicResponseRecord, PublicResponseWindow

### Community 40 - "Folder Responsibilities"
Cohesion: 0.11
Nodes (18): AI Working Rules, apps/server, apps/web, Coding Rules, Core Architecture, Current Development Strategy, data/generated, docs (+10 more)

### Community 42 - "Game State Model"
Cohesion: 0.13
Nodes (14): Account identity and character identity, Basic turn phases, Canonical match fields, Card locations and current action, Current basic-combat migration, Distance, Dying rescue window, Equipment slots (+6 more)

### Community 43 - "WTK card effect logic"
Cohesion: 0.18
Nodes (10): Basic cards, Delayed tricks, Event and resolver architecture, Immediate tricks, Implementation order, Mounts and armor, Resolver conventions, Scalable card definition schema (+2 more)

### Community 44 - "1. หน้าเว็บไม่มีสไตล์ / "UI หาย" (CSS โหลดไม่ได้ 404 ในโหมด dev)"
Cohesion: 0.18
Nodes (10): 0. ⚠️ อย่ารัน `npm run build` ตอน dev server เปิดอยู่ (สาเหตุหลักของ .next พัง), 1. หน้าเว็บไม่มีสไตล์ / "UI หาย" (CSS โหลดไม่ได้ 404 ในโหมด dev), Troubleshooting (dev), กันไว้, ยืนยันว่าแก้สำเร็จ, วิธีเช็ก (diagnosis) — ทำเร็วๆ, วิธีแก้ (ยืนยันแล้วว่าหาย), สาเหตุ (+2 more)

### Community 45 - "WTK project architecture"
Cohesion: 0.25
Nodes (7): Applications, `apps/server`, `apps/web`, Domain and data flow, Extension boundaries, Root folders, WTK project architecture

### Community 46 - "Feature: card description tooltip (hover/focus)"
Cohesion: 0.29
Nodes (6): Feature: card description tooltip (hover/focus), ทำไม (why), ทดสอบ (verify), สิ่งที่เพิ่ม (what's added), หมายเหตุสำคัญ (important), ไฟล์ที่แก้ (files)

### Community 47 - "Project-SAN · card data pipeline"
Cohesion: 0.29
Nodes (6): Adding a new named card, Project-SAN · card data pipeline, The workflow, What's NOT in here yet, What the converter maps, Why CSV *and* JSON (not just one)

### Community 48 - "ARCHITECTURE"
Cohesion: 0.33
Nodes (5): 1. Tech Stack, 2. Directory Tree, 3. Core Modules, 4. Data & Control Flow, ARCHITECTURE

### Community 49 - "Current System Status"
Cohesion: 0.33
Nodes (5): Completed, Current Milestone, Current System Status, Definition of Playable Prototype, Incomplete / Prototype Behavior

### Community 50 - "Lobby, seats, spectator, and reconnect model"
Cohesion: 0.33
Nodes (5): Disconnect policy, Lobby, seats, spectator, and reconnect model, Member state, Server actions, Visual rotation

### Community 51 - "Fix: mass-trick demo responses use the correct card type"
Cohesion: 0.40
Nodes (4): Fix: mass-trick demo responses use the correct card type, ปัญหา (the bug), วิธีทดสอบ (how to verify), สิ่งที่แก้ (the fix)

## Knowledge Gaps
- **272 isolated node(s):** `name`, `private`, `type`, `dev`, `start` (+267 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `card()` connect `index.ts` to `page.tsx`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `Home()` connect `page.tsx` to `index.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `getPlayerById()` connect `index.ts` to `index.ts`, `basic-combat.scenarios.ts`, `page.tsx`, `beginPlayAfterCharacters`, `resolvePlayerDeath`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _272 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07420357420357421 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13068181818181818 - nodes in this community are weakly interconnected._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08305084745762711 - nodes in this community are weakly interconnected._