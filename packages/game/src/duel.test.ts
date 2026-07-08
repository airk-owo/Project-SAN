import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  playCard,
  playAttackResponse,
  declineResponse,
  type Card,
  type GameState,
} from "./index.js";
import {
  makeCard as baseCard,
  makeCharacter,
  makeStandardGame,
} from "./test-helpers.js";

// ไฟล์นี้ default ♣/5/effectParams ว่าง (ต่างจาก helper กลาง ♥/K/{damage:1})
const makeCard = (id: string, effect: string, cardType = "basic"): Card =>
  baseCard(id, effect, cardType, { suit: "♣", number: "5", effectParams: {} });
const attackCard = (id: string): Card => makeCard(id, "attack", "basic");
const duelCard = (id: string): Card =>
  makeCard(id, "duel_attack_response", "trick");

const makeGame = (): GameState =>
  makeStandardGame({ characterFor: (_id, i) => makeCharacter(`C${i}`) });

describe("Duel (ท้าสู้) – normal flow", () => {
  it("opens on the target, who must respond first", () => {
    const game = makeGame();
    game.players.find((p) => p.id === "p0")!.hand = [duelCard("duel")];
    playCard(game, "p0", "duel", "p1");
    assert.equal(game.responseWindow?.type, "duel_attack");
    assert.equal(game.responseWindow?.currentResponderId, "p1");
  });

  it("flips responders after each single attack (normal characters)", () => {
    const game = makeGame();
    game.players.find((p) => p.id === "p0")!.hand = [
      duelCard("duel"),
      attackCard("a0"),
    ];
    game.players.find((p) => p.id === "p1")!.hand = [attackCard("a1")];
    playCard(game, "p0", "duel", "p1");
    playAttackResponse(game, "p1", "a1");
    assert.equal(
      game.responseWindow?.currentResponderId,
      "p0",
      "flips to actor after one attack",
    );
    playAttackResponse(game, "p0", "a0");
    assert.equal(
      game.responseWindow?.currentResponderId,
      "p1",
      "flips back to target",
    );
  });

  it("the player who cannot answer loses the duel and takes 1 damage", () => {
    const game = makeGame();
    const p1 = game.players.find((p) => p.id === "p1")!;
    game.players.find((p) => p.id === "p0")!.hand = [duelCard("duel")];
    p1.hand = []; // target cannot respond at all
    const hpBefore = p1.hp!;
    playCard(game, "p0", "duel", "p1");
    declineResponse(game, "p1");
    assert.equal(p1.hp, hpBefore - 1, "target lost the duel");
    assert.equal(game.responseWindow, null, "duel resolved");
  });
});
