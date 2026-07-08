import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  useDiscardTwoAsAttack,
  respondToAttack,
  playDodge,
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
const handCard = (id: string, suit: string = "♠"): Card =>
  makeCard(id, "attack", "basic", { suit });
const dodgeCard = (id: string): Card => makeCard(id, "dodge", "basic");
const snakeSpear = (id: string): Card =>
  makeCard(id, "discard_two_as_attack", "weapon", {
    type: "weapon",
    equipmentSlot: "weapon",
  });
const renwangShield = (id: string): Card =>
  makeCard(id, "black_attack_immunity", "armor", {
    type: "armor",
    equipmentSlot: "armor",
  });

const makePlayingGame = (): GameState => makeStandardGame();

describe("Snake Spear – discard_two_as_attack", () => {
  it("discards both chosen cards and opens an attack-dodge window on the target", () => {
    const game = makePlayingGame();
    const attacker = game.players.find((p) => p.id === "p0")!;
    attacker.equipment.weapon = snakeSpear("spear");
    attacker.hand = [handCard("a"), handCard("b"), handCard("keep")];
    useDiscardTwoAsAttack(game, "p0", ["a", "b"], "p1");
    assert.equal(attacker.hand.length, 1, "two cards leave the hand");
    assert.ok(
      game.discard.some((c) => c.id === "b"),
      "second card discarded immediately",
    );
    assert.equal(game.responseWindow?.type, "attack_dodge");
    assert.equal(game.responseWindow?.currentResponderId, "p1");
    assert.equal(game.turn.attackUsedThisTurn, 1, "counts as the turn attack");
  });

  it("deals damage when the target declines to dodge", () => {
    const game = makePlayingGame();
    const attacker = game.players.find((p) => p.id === "p0")!;
    const target = game.players.find((p) => p.id === "p1")!;
    attacker.equipment.weapon = snakeSpear("spear");
    attacker.hand = [handCard("a"), handCard("b")];
    useDiscardTwoAsAttack(game, "p0", ["a", "b"], "p1");
    respondToAttack(game, "p1"); // decline
    assert.equal(target.hp, 3, "target takes 1 damage");
  });

  it("is cancelled when the target dodges", () => {
    const game = makePlayingGame();
    const attacker = game.players.find((p) => p.id === "p0")!;
    const target = game.players.find((p) => p.id === "p1")!;
    attacker.equipment.weapon = snakeSpear("spear");
    attacker.hand = [handCard("a"), handCard("b")];
    target.hand = [dodgeCard("d1")];
    useDiscardTwoAsAttack(game, "p0", ["a", "b"], "p1");
    playDodge(game, "p1", "d1");
    assert.equal(target.hp, 4, "no damage after dodge");
    assert.equal(game.responseWindow, null, "window closed");
  });

  it("two black cards are blocked by Renwang Shield", () => {
    const game = makePlayingGame();
    const attacker = game.players.find((p) => p.id === "p0")!;
    const target = game.players.find((p) => p.id === "p1")!;
    attacker.equipment.weapon = snakeSpear("spear");
    target.equipment.armor = renwangShield("shield");
    attacker.hand = [handCard("a", "♠"), handCard("b", "♣")];
    useDiscardTwoAsAttack(game, "p0", ["a", "b"], "p1");
    assert.equal(game.responseWindow, null, "no dodge window — attack blocked");
    assert.equal(target.hp, 4, "no damage");
  });

  it("a red + black pair is NOT blocked by Renwang Shield", () => {
    const game = makePlayingGame();
    const attacker = game.players.find((p) => p.id === "p0")!;
    const target = game.players.find((p) => p.id === "p1")!;
    attacker.equipment.weapon = snakeSpear("spear");
    target.equipment.armor = renwangShield("shield");
    attacker.hand = [handCard("a", "♥"), handCard("b", "♣")];
    useDiscardTwoAsAttack(game, "p0", ["a", "b"], "p1");
    assert.equal(game.responseWindow?.type, "attack_dodge", "attack proceeds");
  });

  it("throws without the Snake Spear weapon", () => {
    const game = makePlayingGame();
    game.players.find((p) => p.id === "p0")!.hand = [
      handCard("a"),
      handCard("b"),
    ];
    assert.throws(() => useDiscardTwoAsAttack(game, "p0", ["a", "b"], "p1"));
  });

  it("throws when fewer than two distinct cards are chosen", () => {
    const game = makePlayingGame();
    const attacker = game.players.find((p) => p.id === "p0")!;
    attacker.equipment.weapon = snakeSpear("spear");
    attacker.hand = [handCard("a"), handCard("b")];
    assert.throws(() => useDiscardTwoAsAttack(game, "p0", ["a", "a"], "p1"));
  });

  it("respects the one-attack-per-turn limit", () => {
    const game = makePlayingGame();
    const attacker = game.players.find((p) => p.id === "p0")!;
    attacker.equipment.weapon = snakeSpear("spear");
    attacker.hand = [handCard("a"), handCard("b")];
    game.turn.attackUsedThisTurn = 1;
    assert.throws(() => useDiscardTwoAsAttack(game, "p0", ["a", "b"], "p1"));
  });
});
