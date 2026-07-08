import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  playAttack,
  respondToAttack,
  replaceAttackDamageByDiscarding,
  declineReplaceAttackDamage,
  type Card,
  type GameState,
} from "./index.js";
import { makeCard as baseCard, makeStandardGame } from "./test-helpers.js";

// ไฟล์นี้ default ♠ (ต่างจาก helper กลาง ♥)
const makeCard = (
  id: string,
  effect: string,
  cardType: string = "basic",
  extra: Partial<Card> = {},
): Card => baseCard(id, effect, cardType, { suit: "♠", ...extra });
const attackCard = (id: string): Card => makeCard(id, "attack", "basic");
const iceSword = (id: string): Card =>
  makeCard(id, "replace_damage_with_discard_two", "weapon", {
    type: "weapon",
    equipmentSlot: "weapon",
  });

/** 4-player game in the play phase with p0 (seat 1) active and already drawn. */
const makePlayingGame = (): GameState => makeStandardGame();

/** p0 equips the Ice Sword, attacks p1 who has `targetHand` hand cards, then p1 declines to dodge. */
function attackDeclined(targetHand: Card[]): {
  game: GameState;
  target: ReturnType<GameState["players"]["find"]>;
} {
  const game = makePlayingGame();
  const attacker = game.players.find((p) => p.id === "p0")!;
  const target = game.players.find((p) => p.id === "p1")!;
  attacker.equipment.weapon = iceSword("ice1");
  attacker.hand = [attackCard("atk1")];
  target.hand = targetHand;
  playAttack(game, "p0", "p1", "atk1");
  respondToAttack(game, "p1"); // no dodge card = decline
  return { game, target };
}

describe("Ice Sword – replace_damage_with_discard_two", () => {
  it("opens a replace-damage decision and deals no damage yet when the target has cards", () => {
    const { game, target } = attackDeclined([
      attackCard("v1"),
      attackCard("v2"),
    ]);
    assert.ok(game.pendingReplaceDamage, "pendingReplaceDamage should be set");
    assert.equal(game.pendingReplaceDamage?.attackerId, "p0");
    assert.equal(game.pendingReplaceDamage?.targetId, "p1");
    assert.equal(target!.hp, 4, "target should not have taken damage yet");
  });

  it("discards the two chosen target cards instead of dealing damage", () => {
    const { game, target } = attackDeclined([
      attackCard("v1"),
      attackCard("v2"),
    ]);
    replaceAttackDamageByDiscarding(game, "p0", [
      { zone: "hand", handIndex: 0 },
      { zone: "hand", handIndex: 1 },
    ]);
    assert.equal(target!.hand.length, 0, "both target hand cards discarded");
    assert.ok(
      game.discard.some((c) => c.id === "v1") &&
        game.discard.some((c) => c.id === "v2"),
      "discarded cards land in the discard pile",
    );
    assert.equal(target!.hp, 4, "target took no damage");
    assert.equal(game.pendingReplaceDamage, undefined, "decision cleared");
  });

  it("can discard a single card when only one is chosen", () => {
    const { game, target } = attackDeclined([
      attackCard("v1"),
      attackCard("v2"),
    ]);
    replaceAttackDamageByDiscarding(game, "p0", [
      { zone: "hand", handIndex: 1 },
    ]);
    assert.equal(target!.hand.length, 1, "one card remains");
    assert.equal(target!.hp, 4, "no damage");
  });

  it("declining applies the normal attack damage", () => {
    const { game, target } = attackDeclined([attackCard("v1")]);
    declineReplaceAttackDamage(game, "p0");
    assert.equal(target!.hp, 3, "target took 1 damage");
    assert.equal(game.pendingReplaceDamage, undefined, "decision cleared");
  });

  it("does not open the decision when the target has no cards (normal damage applies)", () => {
    const { game, target } = attackDeclined([]);
    assert.equal(
      game.pendingReplaceDamage,
      undefined,
      "no ice-sword window without cards",
    );
    assert.equal(target!.hp, 3, "normal damage applied immediately");
  });

  it("rejects choosing more cards than the target has", () => {
    const { game } = attackDeclined([attackCard("v1")]);
    assert.throws(() =>
      replaceAttackDamageByDiscarding(game, "p0", [
        { zone: "hand", handIndex: 0 },
        { zone: "hand", handIndex: 1 },
      ]),
    );
  });

  it("rejects a decision from a player who is not the pending attacker", () => {
    const { game } = attackDeclined([attackCard("v1")]);
    assert.throws(() => declineReplaceAttackDamage(game, "p2"));
  });
});
