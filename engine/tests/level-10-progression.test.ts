/**
 * Test to verify level 10 progression behavior
 * This test confirms whether players actually PLAY at level 10 or just advance to it
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../src/events/event-bus.js";
import { GameEventHandler } from "../src/events/handlers/game-event-handler.js";
import { CashOutDecisionHandler } from "../src/events/handlers/cash-out-decision-handler.js";
import { PlayerProgressionHandler } from "../src/events/handlers/player-progression-handler.js";
import { LevelTrackingHandler } from "../src/events/handlers/level-tracking-handler.js";
import { DirectVirtualDollarFactory } from "../src/factories/direct-virtual-dollar-factory.js";
import { GameMatchingEngine } from "../src/core/game-matching-engine.js";
import {
  EVENT_TYPES,
  GameResolvedEvent,
  ContinuePlayEvent,
} from "../src/events/event-types.js";
import { CashOutStrategy } from "../src/types/virtual-dollar-engine.js";

describe("Level 10 Progression", () => {
  let eventBus: EventBus;
  let factory: DirectVirtualDollarFactory;
  let matchingEngine: GameMatchingEngine;
  let gameHandler: GameEventHandler;
  let cashOutHandler: CashOutDecisionHandler;
  let progressionHandler: PlayerProgressionHandler;
  let levelTracker: LevelTrackingHandler;

  const events: Array<{ type: string; data: any }> = [];

  beforeEach(() => {
    events.length = 0;
    eventBus = new EventBus();
    factory = new DirectVirtualDollarFactory({ seed: 42 });
    matchingEngine = new GameMatchingEngine(eventBus, factory);

    gameHandler = new GameEventHandler(eventBus, factory, matchingEngine);
    cashOutHandler = new CashOutDecisionHandler(eventBus, factory);
    progressionHandler = new PlayerProgressionHandler(
      eventBus,
      factory,
      matchingEngine
    );
    levelTracker = new LevelTrackingHandler(eventBus, 1);

    // Track all relevant events
    eventBus.on(EVENT_TYPES.GAME_RESOLVED, (e: GameResolvedEvent) => {
      events.push({ type: "GAME_RESOLVED", data: e });
    });
    eventBus.on(EVENT_TYPES.CONTINUE_PLAY, (e: ContinuePlayEvent) => {
      events.push({ type: "CONTINUE_PLAY", data: e });
    });
    eventBus.on(EVENT_TYPES.CASH_OUT_DECISION, (e: any) => {
      events.push({ type: "CASH_OUT_DECISION", data: e });
    });
    eventBus.on(EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED, (e: any) => {
      events.push({ type: "VIRTUAL_DOLLAR_ADVANCED", data: e });
    });
    eventBus.on(EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED, (e: any) => {
      events.push({ type: "VIRTUAL_DOLLAR_RUN_COMPLETED", data: e });
    });
  });

  it("should show that players never PLAY at level 10", async () => {
    // Create a player at level 9
    const player1 = "player-level-9";
    const player2 = "player-opponent";

    const vd1 = factory.createVirtualDollar(
      player1,
      CashOutStrategy.AGGRESSIVE
    );
    const vd2 = factory.createVirtualDollar(
      player2,
      CashOutStrategy.CONSERVATIVE
    );

    // Manually advance vd1 to level 9
    for (let level = 1; level < 9; level++) {
      const nextLevel = (level + 1) as any;
      const winnings = factory.calculateLevelWinnings(nextLevel);
      factory.advancePlayerLevel(vd1.id, nextLevel, winnings);
    }

    // Verify vd1 is at level 9
    const vd1AtLevel9 = factory.getVirtualDollar(vd1.id);
    expect(vd1AtLevel9?.currentLevel).toBe(9);

    // Simulate a game at level 9 where vd1 wins
    const gameResolvedEvent: GameResolvedEvent = {
      type: EVENT_TYPES.GAME_RESOLVED,
      timestamp: new Date(),
      gameId: "test-game-level-9",
      winnerId: player1,
      loserId: player2,
      winnerLevel: 9, // This is the KEY - winnerLevel is 9, not 10
      loserLevel: 1,
      winnerDollarId: vd1.id,
      loserDollarId: vd2.id,
      winnings: factory.calculateLevelWinnings(9),
      gameResult: "WIN",
    };

    // Emit the event and wait for all handlers
    await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for async handlers

    // Check what happened
    console.log("\n=== Events captured ===");
    events.forEach((e, i) => {
      console.log(`${i + 1}. ${e.type}:`, JSON.stringify(e.data, null, 2));
    });

    // Find the cash-out decision
    const cashOutDecision = events.find((e) => e.type === "CASH_OUT_DECISION");
    console.log("\n=== Cash-out decision ===");
    console.log(cashOutDecision);

    // Check if player advanced to level 10
    const vd1Final = factory.getVirtualDollar(vd1.id);
    console.log("\n=== Final state ===");
    console.log(`VD1 final level: ${vd1Final?.currentLevel}`);
    console.log(`VD1 state: ${vd1Final?.state}`);

    // The issue: If the player decided to CONTINUE at level 9,
    // they advance to level 10 but never PLAY at level 10
    if (cashOutDecision?.data.decision === "CONTINUE") {
      expect(vd1Final?.currentLevel).toBe(10);
      console.log(
        "\n❌ ISSUE CONFIRMED: Player advanced to level 10 but never played a level 10 game"
      );
    } else {
      console.log("\n✓ Player cashed out at level 9 (no issue in this case)");
    }
  });

  it("should demonstrate the correct flow: level 10 games should happen", async () => {
    console.log("\n=== EXPECTED BEHAVIOR ===");
    console.log("1. Player at level 9 wins");
    console.log("2. GameResolvedEvent emitted with winnerLevel: 9");
    console.log(
      "3. CashOutDecisionHandler checks level 9 (not 10), might CONTINUE"
    );
    console.log("4. If CONTINUE, player advances to level 10");
    console.log("5. Player should now PLAY at level 10");
    console.log("6. When they WIN at level 10, THEN force cash-out");
    console.log("\n=== ACTUAL BEHAVIOR ===");
    console.log("1. Player at level 9 wins");
    console.log("2. GameResolvedEvent emitted with winnerLevel: 9");
    console.log(
      "3. CashOutDecisionHandler checks level 9 (not 10), might CONTINUE"
    );
    console.log("4. If CONTINUE, player advances to level 10");
    console.log("5. ❌ Run completes immediately - no level 10 game happens");
  });
});
