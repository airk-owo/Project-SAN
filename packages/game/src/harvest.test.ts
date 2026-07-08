import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  playHarvest,
  pickHarvestCard,
  type Card,
  type GameState,
} from "./index.js";
import {
  makeCard as baseCard,
  makeStandardGame,
  passNegate,
} from "./test-helpers.js";

// ไฟล์นี้ effectParams ว่างเสมอ (ต่างจาก helper กลางที่ default {damage:1})
const makeCard = (id: string, effect: string, cardType: string = "basic"): Card =>
  baseCard(id, effect, cardType, { effectParams: {} });
const harvestCard = (id: string): Card =>
  makeCard(id, "reveal_and_draft_cards", "trick");
const poolCard = (id: string): Card => makeCard(id, "attack", "basic");

function makeGame(deck: Card[]): GameState {
  const game = makeStandardGame({ deck });
  game.players.find((p) => p.id === "p0")!.hand = [harvestCard("h1")];
  return game;
}

describe("Harvest – reveal_and_draft_cards", () => {
  it("reveals one card per living player and opens a pick window on the actor", () => {
    const game = makeGame([
      poolCard("a"),
      poolCard("b"),
      poolCard("c"),
      poolCard("d"),
    ]);
    playHarvest(game, "p0", "h1");
    passNegate(game);
    assert.equal(
      game.pendingHarvest?.revealed.length,
      4,
      "one card per living player",
    );
    assert.equal(game.responseWindow?.type, "harvest_pick");
    assert.equal(
      game.responseWindow?.currentResponderId,
      "p0",
      "actor picks first",
    );
    assert.deepEqual(game.responseWindow?.responderQueue, [
      "p0",
      "p1",
      "p2",
      "p3",
    ]);
  });

  it("each player drafts one card in turn order, then the window closes", () => {
    const game = makeGame([
      poolCard("a"),
      poolCard("b"),
      poolCard("c"),
      poolCard("d"),
    ]);
    playHarvest(game, "p0", "h1");
    passNegate(game);
    for (const pid of ["p0", "p1", "p2", "p3"]) {
      assert.equal(
        game.responseWindow?.currentResponderId,
        pid,
        `it is ${pid}'s turn`,
      );
      pickHarvestCard(game, pid, game.pendingHarvest!.revealed[0]!.id);
    }
    assert.equal(
      game.responseWindow,
      null,
      "window closed after everyone drafts",
    );
    assert.equal(game.pendingHarvest, undefined);
    assert.ok(
      game.players.every((p) => p.hand.length === 1),
      "each player drafted exactly one card",
    );
  });

  it("rejects picking out of turn", () => {
    const game = makeGame([
      poolCard("a"),
      poolCard("b"),
      poolCard("c"),
      poolCard("d"),
    ]);
    playHarvest(game, "p0", "h1");
    passNegate(game);
    assert.throws(() =>
      pickHarvestCard(game, "p1", game.pendingHarvest!.revealed[0]!.id),
    );
  });

  it("rejects picking a card that is not in the revealed pool", () => {
    const game = makeGame([
      poolCard("a"),
      poolCard("b"),
      poolCard("c"),
      poolCard("d"),
    ]);
    playHarvest(game, "p0", "h1");
    passNegate(game);
    assert.throws(() => pickHarvestCard(game, "p0", "not-there"));
  });

  it("when the deck is short, only the earliest pickers draft and the window still closes", () => {
    const game = makeGame([poolCard("a"), poolCard("b")]); // only 2 cards for 4 players
    playHarvest(game, "p0", "h1");
    passNegate(game);
    assert.equal(game.pendingHarvest?.revealed.length, 2);
    pickHarvestCard(game, "p0", game.pendingHarvest!.revealed[0]!.id);
    pickHarvestCard(game, "p1", game.pendingHarvest!.revealed[0]!.id);
    assert.equal(
      game.responseWindow,
      null,
      "window closes once the pool is empty",
    );
    assert.equal(game.players.find((p) => p.id === "p0")!.hand.length, 1);
    assert.equal(game.players.find((p) => p.id === "p1")!.hand.length, 1);
    assert.equal(
      game.players.find((p) => p.id === "p2")!.hand.length,
      0,
      "no card left for p2",
    );
  });

  it("leftover revealed cards are discarded", () => {
    const game = makeGame([
      poolCard("a"),
      poolCard("b"),
      poolCard("c"),
      poolCard("d"),
    ]);
    playHarvest(game, "p0", "h1");
    passNegate(game);
    // Kill p2 and p3 so only p0 and p1 remain in the pick queue while 4 cards are revealed.
    game.players.find((p) => p.id === "p2")!.alive = false;
    game.players.find((p) => p.id === "p3")!.alive = false;
    pickHarvestCard(game, "p0", game.pendingHarvest!.revealed[0]!.id);
    pickHarvestCard(game, "p1", game.pendingHarvest!.revealed[0]!.id);
    assert.equal(game.responseWindow, null, "window closed with leftovers");
    assert.equal(game.pendingHarvest, undefined);
    assert.ok(
      game.discard.some(
        (c) => c.id === "a" || c.id === "b" || c.id === "c" || c.id === "d",
      ),
      "leftovers discarded",
    );
  });
});
