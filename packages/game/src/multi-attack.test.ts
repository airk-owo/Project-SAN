import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  playLastHandMultiAttack,
  playMassResponseCard,
  declineMassResponse,
  type Card,
  type GameState,
} from "./index.js";
import {
  makeCard,
  attackCard,
  dodgeCard,
  makeStandardGame,
} from "./test-helpers.js";

const zhangbaSpear = (id: string): Card =>
  makeCard(id, "last_hand_multi_target_attack", "weapon", {
    type: "weapon",
    equipmentSlot: "weapon",
    effectParams: { range: 3 },
  });

function makeGame(): GameState {
  const game = makeStandardGame();
  const attacker = game.players.find((p) => p.id === "p0")!;
  attacker.equipment.weapon = zhangbaSpear("spear");
  attacker.hand = [attackCard("atk1")];
  return game;
}

describe("Zhangba Spear – last_hand_multi_target_attack", () => {
  it("opens a multi_attack window queued on the chosen targets", () => {
    const game = makeGame();
    playLastHandMultiAttack(game, "p0", "atk1", ["p1", "p2"]);
    assert.equal(game.responseWindow?.type, "multi_attack");
    assert.equal(game.responseWindow?.currentResponderId, "p1");
    assert.deepEqual(game.responseWindow?.responderQueue, ["p1", "p2"]);
    assert.equal(game.turn.attackUsedThisTurn, 1);
  });

  it("resolves each target independently: one dodges, one takes damage", () => {
    const game = makeGame();
    const p1 = game.players.find((p) => p.id === "p1")!;
    const p2 = game.players.find((p) => p.id === "p2")!;
    p2.hand = [dodgeCard("d2")];
    playLastHandMultiAttack(game, "p0", "atk1", ["p1", "p2"]);
    declineMassResponse(game, "p1"); // p1 takes damage
    playMassResponseCard(game, "p2", "d2"); // p2 dodges
    assert.equal(p1.hp, 3, "p1 took 1 damage");
    assert.equal(p2.hp, 4, "p2 dodged, unharmed");
    assert.equal(game.responseWindow, null, "all targets resolved");
    assert.ok(
      game.discard.some((c) => c.id === "atk1"),
      "the attack card is discarded once at the end",
    );
  });

  it("handles three targets in order", () => {
    const game = makeGame();
    const [p1, p2, p3] = ["p1", "p2", "p3"].map(
      (id) => game.players.find((p) => p.id === id)!,
    );
    playLastHandMultiAttack(game, "p0", "atk1", ["p1", "p2", "p3"]);
    declineMassResponse(game, "p1");
    declineMassResponse(game, "p2");
    declineMassResponse(game, "p3");
    assert.equal(p1!.hp, 3);
    assert.equal(p2!.hp, 3);
    assert.equal(p3!.hp, 3);
    assert.equal(game.responseWindow, null);
  });

  it("a target dropping to 0 opens a dying window, then the queue resumes", () => {
    const game = makeGame();
    const p1 = game.players.find((p) => p.id === "p1")!;
    p1.hp = 1;
    playLastHandMultiAttack(game, "p0", "atk1", ["p1", "p2"]);
    declineMassResponse(game, "p1"); // p1 → 0 HP, dying window opens
    assert.equal(
      game.responseWindow?.type,
      "dying_heal",
      "dying window interrupts the queue",
    );
    assert.equal(game.responseWindow?.dyingPlayerId, "p1");
  });

  it("throws when the attack is not the last hand card", () => {
    const game = makeGame();
    game.players.find((p) => p.id === "p0")!.hand = [
      attackCard("atk1"),
      attackCard("extra"),
    ];
    assert.throws(
      () => playLastHandMultiAttack(game, "p0", "atk1", ["p1", "p2"]),
      /ใบสุดท้าย/,
    );
  });

  it("throws when more than three targets are chosen", () => {
    const game = makeGame();
    assert.throws(() =>
      playLastHandMultiAttack(game, "p0", "atk1", ["p1", "p2", "p3", "p0"]),
    );
  });

  it("throws without the multi-target weapon", () => {
    const game = makeGame();
    game.players.find((p) => p.id === "p0")!.equipment.weapon = null;
    assert.throws(() =>
      playLastHandMultiAttack(game, "p0", "atk1", ["p1", "p2"]),
    );
  });
});
