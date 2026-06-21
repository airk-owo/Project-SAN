# WTK card effect logic

This document is the implementation contract for the `backend_effect_key` field in `source/02_card_definitions.csv`. The game server is authoritative: the client requests an action, the resolver validates it, creates any required response window, then commits the resulting state and log entry.

## Scalable card definition schema

Every card definition now has explicit backend metadata. `category` stays as display/source text only; engine behavior must use the fields below.

| Field | Purpose |
| --- | --- |
| `card_type` | One of `basic`, `instant_trick`, `delayed_trick`, `weapon`, `armor`, `offensive_mount`, `defensive_mount`. |
| `backend_effect_key` | Stable resolver identifier. It does not encode numeric balance values. |
| `effect_params` | JSON object containing tunable values such as `damage`, `heal_amount`, or `amount`. |
| `trigger_timing` | Declarative hook timing: `on_play`, `on_response`, `on_judgment`, `on_damage`, `after_damage`, `on_attack_declared`, `on_attack_dodged`, or `passive`. |
| `equipment_slot` | Explicit equipment placement; never inferred from card name or localized category. |
| `creates_response_window` | Whether playing the effect must pause the authoritative game state for responses. |

The TypeScript `Card` model mirrors these fields. The importer validates allowed enum values and parses `effect_params` as JSON.

## Event and resolver architecture

`playCard` routes a `backend_effect_key` to an `EffectResolver`. Resolvers read values from `effect_params`; for example, attack reads `damage` and heal reads `heal_amount`. The shared `dispatchGameEvent` API exposes `before_attack`, `after_attack`, `before_damage`, `after_damage`, `before_judgment`, `after_judgment`, `before_heal`, and `after_heal`.

Future character skills register `EventSubscriber` entries with priority. They may alter or cancel an event, but do not require edits inside a card's resolver. Expansion card effects follow the same pattern: add definition metadata, implement/reuse a resolver, and register only any new generic event hook needed.

## Resolver conventions

- `target` means a chosen living player; range checks use the seat/distance resolver.
- `response window` blocks other actions until every required player responds or declines.
- `judgment` reveals the top draw-pile card, logs it, then discards it.
- `decision area` stores delayed tricks; equipment slots are weapon, armor, offensive horse, defensive horse.
- Character skills may add or replace a step, but never bypass server validation.

## Basic cards

| Key | Logic |
| --- | --- |
| `attack` | Validate one target in range and per-turn limit. Open an attack response window. Target uses `dodge` or declines and takes 1 damage. Attack hooks run before/after dodge and damage. |
| `dodge` | Valid only in an attack response window; discard it and cancel that attack against the responder. |
| `heal` | Target self while wounded, or a dying player in a dying response window. Restore 1 HP, capped at max HP. |

## Immediate tricks

| Key | Logic |
| --- | --- |
| `discard_target_card` | Choose another player then a hidden hand position or visible equipment card. Move chosen card to discard; decision-area support is TODO. |
| `all_others_dodge_or_damage` | Build clockwise response queue of all living players except actor. Each uses `dodge` or takes 1 damage, resolving dying windows before next queue member. |
| `heal_all_living` | Restore 1 HP to every living player, capped at max HP. Each heal may trigger character hooks. |
| `draw_cards` | Actor draws the configured amount (currently 2). |
| `coerce_attack_or_take_weapon` | Actor chooses a player with weapon and a legal victim for that player. Coerced player attacks; if unavailable/declined, actor gains the weapon. |
| `steal_target_card_in_range` | Choose another player at range 1, then choose a hidden hand position or visible equipment card. Transfer it to actor hand; decision-area support is TODO. |
| `negate_trick_effect` | Open trick-negation response chain. Cancel the selected trick effect for a target; another negate may negate the previous negate. Lightning special case moves it to next decision area. |
| `duel_attack_response` | Target responds first; actor and target alternate `attack` through a `duel_attack` response window. First player unable/declining takes 1 damage; response attacks do not consume the normal attack-per-turn limit. |
| `all_others_attack_or_damage` | Clockwise queue of all living players except actor. Each uses `attack` or takes 1 damage. |
| `reveal_and_draft_cards` | Reveal one card per living player; actor then players in turn order each choose one revealed card into hand. Unchosen cards discard. |

`draw_cards` and `heal_all_living` are implemented as immediate play-phase
effects. They require the active living player, a matching card in hand, and no
open response window. `draw_cards` uses `effect_params.amount` with a default
of 2; `heal_all_living` restores 1 HP to each living player without exceeding
max HP. Both effects discard their played card and write a game log entry.
Character-skill heal hooks remain TODO.

## Delayed tricks

| Key | Logic |
| --- | --- |
| `delayed_skip_play_phase` | Place in target decision area if absent. At decision phase, judgment: non-heart skips play phase. Discard this trick after judgment. |
| `delayed_lightning_judgment` | Place in own decision area if absent. At decision phase, spade 2–9 deals 3 lightning damage then discards; otherwise transfer to next legal player decision area. |

## Mounts and armor

| Key | Logic |
| --- | --- |
| `offensive_distance_minus_one` | Equip offensive-horse slot; outgoing distance is reduced by 1, minimum 1. Replacing same slot discards old mount. |
| `defensive_distance_plus_one` | Equip defensive-horse slot; incoming distance is increased by 1. Replacing same slot discards old mount. |
| `black_attack_immunity` | Armor hook: black attack has no effect unless attacker has `ignore_target_armor`. |
| `judgment_dodge` | On attack response, owner may judge. Heart/diamond judgment counts as dodge; otherwise continue normal response. |

## Weapons

| Key | Logic |
| --- | --- |
| `last_hand_multi_target_attack` | If attack is actor's last hand card, allow up to 3 legal targets and resolve each response independently. |
| `discard_two_as_attack` | Owner may discard exactly two hand cards to create a virtual attack with combined suit/color attributes. |
| `unlimited_attack_per_turn` | Removes normal once-per-turn attack limit while equipped. |
| `damage_destroy_target_mount` | After attack damage, owner may choose and discard one target mount. |
| `discard_two_force_attack_damage` | After target dodges, owner may discard two own hand/equipment cards to force original attack damage. |
| `repeat_attack_after_dodge` | After target dodges, owner may start a new attack against the same legal target. |
| `ignore_target_armor` | Attack context marks target armor as inactive for that attack. |
| `opposite_gender_attack_choice` | Before opposite-gender target responds, target chooses discard one hand card or lets attacker draw one. |
| `replace_damage_with_discard_two` | After attack would deal damage to a target with cards, attacker may cancel damage and discard up to two target hand/equipment cards. |

## Implementation order

1. Current: `attack`, `dodge`, `heal`, `draw_cards`, `heal_all_living`, manual hand-limit discard, turn draw, equipment slots, and base distance calculation.
2. Next: shared response queue for mass attacks, duel and negate chain.
3. Then: decision area/judgment and all weapon/character-skill hooks.
