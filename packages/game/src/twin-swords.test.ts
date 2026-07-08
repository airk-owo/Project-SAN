import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  playAttack,
  respondToAttack,
  playDodge,
  resolveTwinSwordsDiscard,
  resolveTwinSwordsLetDraw,
  owedDraws,
  type Card,
  type GameState,
} from "./index.js";
import {
  makeCard,
  attackCard,
  dodgeCard,
  makeCharacter,
  makeStandardGame,
} from "./test-helpers.js";

const twinSwords = (id: string): Card =>
  makeCard(id, "opposite_gender_attack_choice", "weapon", {
    type: "weapon",
    equipmentSlot: "weapon",
  });

/** p0 = male attacker with Twin Swords, p1 = female target. */
function makeGame(targetGender = "หญิง"): GameState {
  const game = makeStandardGame({
    characterFor: (_id, i) =>
      makeCharacter(`char${i}`, { gender: i === 1 ? targetGender : "ชาย" }),
  });
  const attacker = game.players.find((p) => p.id === "p0")!;
  attacker.equipment.weapon = twinSwords("sword");
  attacker.hand = [attackCard("atk1")];
  return game;
}

describe("Twin Swords – opposite_gender_attack_choice", () => {
  it("pauses for a choice (no dodge window yet) when attacking the opposite gender", () => {
    const game = makeGame();
    game.players.find((p) => p.id === "p1")!.hand = [attackCard("v1")];
    playAttack(game, "p0", "p1", "atk1");
    assert.ok(game.pendingTwinSwords, "twin-swords choice should be pending");
    assert.equal(game.pendingTwinSwords?.targetId, "p1");
    assert.equal(
      game.responseWindow,
      null,
      "the dodge window has not opened yet",
    );
    assert.equal(
      game.turn.attackUsedThisTurn,
      0,
      "attack not counted until it proceeds",
    );
  });

  it("does NOT pause when attacking the same gender", () => {
    const game = makeGame("ชาย"); // target same gender as attacker
    playAttack(game, "p0", "p1", "atk1");
    assert.equal(game.pendingTwinSwords, undefined, "no twin-swords choice");
    assert.equal(
      game.responseWindow?.type,
      "attack_dodge",
      "normal dodge window opens directly",
    );
  });

  it("discard choice removes a target card and then opens the dodge window", () => {
    const game = makeGame();
    const target = game.players.find((p) => p.id === "p1")!;
    target.hand = [attackCard("v1")];
    playAttack(game, "p0", "p1", "atk1");
    resolveTwinSwordsDiscard(game, "p1", "v1");
    assert.ok(!target.hand.some((c) => c.id === "v1"), "target card discarded");
    assert.equal(game.pendingTwinSwords, undefined, "choice cleared");
    assert.equal(
      game.responseWindow?.type,
      "attack_dodge",
      "dodge window now open",
    );
    assert.equal(game.turn.attackUsedThisTurn, 1, "attack now counted");
  });

  it("let-draw choice draws a card for the attacker and then opens the dodge window", () => {
    const game = makeGame();
    const attacker = game.players.find((p) => p.id === "p0")!;
    game.deck = [attackCard("deck1")];
    playAttack(game, "p0", "p1", "atk1");
    resolveTwinSwordsLetDraw(game, "p1");
    assert.equal(owedDraws(game, "p0"), 1, "attacker is owed a manual draw");
    assert.equal(
      game.responseWindow?.type,
      "attack_dodge",
      "dodge window now open",
    );
  });

  it("after the choice the target can still dodge normally", () => {
    const game = makeGame();
    const target = game.players.find((p) => p.id === "p1")!;
    target.hand = [dodgeCard("d1"), attackCard("v1")];
    playAttack(game, "p0", "p1", "atk1");
    resolveTwinSwordsLetDraw(game, "p1");
    playDodge(game, "p1", "d1");
    assert.equal(target.hp, 4, "dodged, no damage");
    assert.equal(game.responseWindow, null, "window resolved");
  });

  it("declining to dodge after the choice deals damage", () => {
    const game = makeGame();
    const target = game.players.find((p) => p.id === "p1")!;
    target.hand = [attackCard("v1")];
    playAttack(game, "p0", "p1", "atk1");
    resolveTwinSwordsDiscard(game, "p1", "v1");
    respondToAttack(game, "p1"); // decline dodge
    assert.equal(target.hp, 3, "takes 1 damage");
  });

  it("rejects a choice from someone who is not the pending target", () => {
    const game = makeGame();
    playAttack(game, "p0", "p1", "atk1");
    assert.throws(() => resolveTwinSwordsLetDraw(game, "p2"));
  });
});
