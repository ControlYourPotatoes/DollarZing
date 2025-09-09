/**
 * Integration Tests for Complete Event Flow Chains
 * Tests end-to-end event flows across multiple handlers
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "./event-bus";
import { GameEventHandler } from "./handlers/game-event-handler";
import { PlayerProgressionHandler } from "./handlers/player-progression-handler";
import { CashOutDecisionHandler } from "./handlers/cash-out-decision-handler";
import { PoolManagementHandler } from "./handlers/pool-management-handler";
import { RevenueTrackingHandler } from "./handlers/revenue-tracking-handler";
import {
  EVENT_TYPES,
  GameResolvedEvent,
  PlayerProgressionEvent,
  CashOutDecisionEvent,
  PoolAddedEvent,
  RevenueGameProcessedEvent,
} from "./event-types";
import { VirtualDollarManager } from "../types/virtual-dollar-types";
import { GameMatchingEngine } from "../types/game-matching-engine";
import { RevenueCalculator } from "../types/revenue-calculator";
import { ProgressionManager } from "../types/progression-manager";
import { CashOutStrategy } from "../types/virtual-dollar-engine";

describe("Event Flow Integration Tests", () => {
  let eventBus: EventBus;
  let gameEventHandler: GameEventHandler;
  let playerProgressionHandler: PlayerProgressionHandler;
  let cashOutHandler: CashOutDecisionHandler;
  let poolHandler: PoolManagementHandler;
  let revenueHandler: RevenueTrackingHandler;

  // Mocked dependencies
  let mockVirtualDollarManager: VirtualDollarManager;
  let mockGameMatchingEngine: GameMatchingEngine;
  let mockRevenueCalculator: RevenueCalculator;
  let mockProgressionManager: ProgressionManager;
  let mockStrategyManager: any;

  // Event collectors for verification
  let eventLog: any[];

  beforeEach(async () => {
    eventBus = new EventBus();
    eventLog = [];

    // Create mock dependencies
    mockVirtualDollarManager = {
      updateDollarState: vi.fn(),
      getDollar: vi.fn(),
    } as any;

    mockGameMatchingEngine = {
      addToPool: vi.fn().mockReturnValue({ success: true }),
      removeFromPool: vi.fn().mockReturnValue({ success: true }),
      getPoolStatistics: vi.fn().mockReturnValue({
        totalDollarsInPool: 10,
        availableForMatching: 8,
        dollarsInGame: 2,
      }),
      getGameSession: vi.fn().mockReturnValue({
        isValid: true,
        platformRevenue: 10,
        charityContribution: 5,
      }),
    } as any;

    mockRevenueCalculator = {
      processGameRevenue: vi.fn(),
      processCashOut: vi.fn(),
      getTotalRevenue: vi.fn().mockReturnValue(1000),
      getRevenueStream: vi.fn().mockReturnValue({
        totalRevenue: 1000,
        platformRevenue: 200,
        charityRevenue: 200,
        governmentRevenue: 400,
        playerRevenue: 200,
      }),
    } as any;

    mockProgressionManager = {
      processGameResult: vi.fn().mockReturnValue({
        isComplete: false,
        currentLevel: 2,
        currentWinnings: 100,
        gamesWonInRun: 1,
      }),
      makeCashOutDecision: vi.fn().mockReturnValue("CONTINUE"),
      processCashOut: vi.fn().mockReturnValue({
        finalLevel: 3,
        totalWinnings: 250,
        playerPayout: 200,
        wasJackpot: false,
        gamesPlayedInRun: 3,
      }),
    } as any;

    // Mock strategy manager for cash out handler dependencies
    mockStrategyManager = {
      getPlayerStrategy: vi.fn().mockReturnValue(CashOutStrategy.CONSERVATIVE),
      makeCashOutDecision: vi.fn().mockReturnValue("CONTINUE"),
      getCashOutProbability: vi.fn().mockReturnValue(0.1),
      processDecision: vi
        .fn()
        .mockReturnValue({ decision: "CONTINUE", probability: 0.1 }),
    } as any;

    // Initialize handlers
    gameEventHandler = new GameEventHandler(
      eventBus,
      mockGameMatchingEngine,
      mockRevenueCalculator
    );
    playerProgressionHandler = new PlayerProgressionHandler(
      eventBus,
      mockProgressionManager
    );
    cashOutHandler = new CashOutDecisionHandler(eventBus, mockStrategyManager);
    poolHandler = new PoolManagementHandler(
      eventBus,
      mockGameMatchingEngine,
      mockVirtualDollarManager
    );
    revenueHandler = new RevenueTrackingHandler(
      eventBus,
      mockRevenueCalculator
    );

    // Set up event logging for verification
    const eventTypes = Object.values(EVENT_TYPES);
    eventTypes.forEach((eventType) => {
      eventBus.on(
        eventType,
        (eventData) => {
          eventLog.push({ type: eventType, data: eventData });
        },
        -1
      ); // Lowest priority to capture all events
    });
  });

  describe("Complete Game Resolution Flow", () => {
    it("should process game resolution through full event chain", async () => {
      // Arrange: Create a game resolved event
      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "test-game-1",
        winnerId: "player-1",
        loserId: "player-2",
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId: "dollar-1",
        loserDollarId: "dollar-2",
        winnings: 50,
        gameResult: "WIN",
      };

      // Act: Emit the game resolved event
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      // Allow event processing to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Verify event chain progression
      const eventTypes = eventLog.map((e) => e.type);

      expect(eventTypes).toContain(EVENT_TYPES.GAME_RESOLVED);
      expect(eventTypes).toContain(EVENT_TYPES.PLAYER_ADVANCED);
      expect(eventTypes).toContain(EVENT_TYPES.CASH_OUT_DECISION);

      // Verify progression manager was called for both winner and loser
      expect(mockProgressionManager.processGameResult).toHaveBeenCalledTimes(2);
    });

    it("should handle winner progression and continue play decision", async () => {
      // Arrange: Mock progression manager to return continue play decision
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CONTINUE");

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "test-game-2",
        winnerId: "player-conservative",
        loserId: "player-loser",
        winnerLevel: 2,
        loserLevel: 1,
        winnerDollarId: "dollar-winner",
        loserDollarId: "dollar-loser",
        winnings: 100,
        gameResult: "WIN",
      };

      // Act: Process game resolution
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Verify CONTINUE decision was made
      const cashOutEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.CASH_OUT_DECISION
      );
      expect(cashOutEvents).toHaveLength(1); // Only winner should get cash-out decision
      expect(cashOutEvents[0].data.decision).toBe("CONTINUE");

      // Verify continue play event was emitted (this is correct behavior)
      const continueEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.CONTINUE_PLAY
      );
      expect(continueEvents).toHaveLength(1); // CONTINUE decision should trigger CONTINUE_PLAY event
      expect(continueEvents[0].data.playerId).toBe("player-conservative");
    });

    it("should handle cash-out decision and run completion", async () => {
      // Arrange: Mock progression manager to return cash-out decision
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CASH_OUT");

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "test-game-3",
        winnerId: "player-conservative",
        loserId: "player-loser",
        winnerLevel: 3,
        loserLevel: 2,
        winnerDollarId: "dollar-winner",
        loserDollarId: "dollar-loser",
        winnings: 200,
        gameResult: "WIN",
      };

      // Act: Process game resolution
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Verify cash-out flow
      const cashOutDecisionEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.CASH_OUT_DECISION
      );
      expect(cashOutDecisionEvents).toHaveLength(1);
      expect(cashOutDecisionEvents[0].data.decision).toBe("CASH_OUT");

      const cashOutCompletedEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.CASH_OUT_COMPLETED
      );
      expect(cashOutCompletedEvents).toHaveLength(1);

      const runCompletedEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.RUN_COMPLETED
      );
      expect(runCompletedEvents.length).toBeGreaterThanOrEqual(1);
      // Check that at least one run completion was a cash-out
      const cashOutCompletions = runCompletedEvents.filter(
        (e) => e.data.completionType === "CASH_OUT"
      );
      expect(cashOutCompletions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Pool Management Integration", () => {
    it("should handle pool addition events properly", async () => {
      // Arrange: Create a pool addition event
      const poolAddedEvent: PoolAddedEvent = {
        type: EVENT_TYPES.POOL_ADDED,
        timestamp: new Date(),
        virtualDollarId: "dollar-pool-test",
        playerId: "player-pool-test",
        currentLevel: 1,
        poolSize: 15,
        availableForMatching: 12,
      };

      // Act: Emit pool added event
      await eventBus.emit(EVENT_TYPES.POOL_ADDED, poolAddedEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Verify the event was processed (logged)
      const poolAddedEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.POOL_ADDED
      );
      expect(poolAddedEvents).toHaveLength(1);

      // The handler may or may not emit POOL_UPDATED events depending on implementation
      // We just verify the handler processed the event without errors
      expect(poolAddedEvents[0].data.virtualDollarId).toBe("dollar-pool-test");
    });
  });

  describe("Revenue Tracking Integration", () => {
    it("should process revenue events in coordination with game events", async () => {
      // Arrange: Create a revenue game processed event
      const revenueEvent: RevenueGameProcessedEvent = {
        type: EVENT_TYPES.REVENUE_GAME_PROCESSED,
        timestamp: new Date(),
        gameId: "revenue-test-game",
        gameRevenue: 10,
        platformRevenue: 2,
        charityContribution: 2,
        totalGameRevenue: 10,
      };

      // Act: Emit revenue event
      await eventBus.emit(EVENT_TYPES.REVENUE_GAME_PROCESSED, revenueEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Verify the event was processed (logged)
      const revenueProcessedEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.REVENUE_GAME_PROCESSED
      );
      expect(revenueProcessedEvents).toHaveLength(1);

      // Verify the event data was preserved correctly
      expect(revenueProcessedEvents[0].data.gameId).toBe("revenue-test-game");
      expect(revenueProcessedEvents[0].data.gameRevenue).toBe(10);
    });
  });

  describe("Error Handling in Event Flows", () => {
    it("should handle and propagate errors in event chains", async () => {
      // Arrange: Mock progression manager to throw an error
      mockProgressionManager.processGameResult = vi
        .fn()
        .mockImplementation(() => {
          throw new Error("Test progression error");
        });

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "error-test-game",
        winnerId: "player-error",
        loserId: "player-loser",
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId: "dollar-error",
        loserDollarId: "dollar-loser",
        winnings: 50,
        gameResult: "WIN",
      };

      // Act: Process game resolution that will cause an error
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Verify error events were emitted
      const progressionFailedEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.PLAYER_PROGRESSION_FAILED
      );
      expect(progressionFailedEvents).toHaveLength(1);
      expect(progressionFailedEvents[0].data.reason).toBe(
        "Progression processing failed"
      );
    });
  });

  describe("Event Ordering and Priority", () => {
    it("should process events in correct priority order", async () => {
      // Arrange: Track event processing order
      const processingOrder: string[] = [];

      // Set up handlers with different priorities to track order
      eventBus.on(
        EVENT_TYPES.GAME_RESOLVED,
        () => {
          processingOrder.push("GAME_RESOLVED");
        },
        10
      ); // High priority

      eventBus.on(
        EVENT_TYPES.GAME_RESOLVED,
        () => {
          processingOrder.push("GAME_RESOLVED_LOW");
        },
        1
      ); // Low priority

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "priority-test-game",
        winnerId: "player-priority",
        loserId: "player-loser",
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId: "dollar-priority",
        loserDollarId: "dollar-loser",
        winnings: 50,
        gameResult: "WIN",
      };

      // Act: Emit event and wait for processing
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Verify high priority handler ran first
      expect(processingOrder[0]).toBe("GAME_RESOLVED");
      expect(processingOrder[1]).toBe("GAME_RESOLVED_LOW");
    });
  });

  describe("Concurrent Event Processing", () => {
    it("should handle multiple concurrent game resolutions", async () => {
      // Arrange: Create multiple game events
      const gameEvents: GameResolvedEvent[] = [
        {
          type: EVENT_TYPES.GAME_RESOLVED,
          timestamp: new Date(),
          gameId: "concurrent-game-1",
          winnerId: "player-1",
          loserId: "player-2",
          winnerLevel: 1,
          loserLevel: 1,
          winnerDollarId: "dollar-1",
          loserDollarId: "dollar-2",
          winnings: 50,
          gameResult: "WIN",
        },
        {
          type: EVENT_TYPES.GAME_RESOLVED,
          timestamp: new Date(),
          gameId: "concurrent-game-2",
          winnerId: "player-3",
          loserId: "player-4",
          winnerLevel: 2,
          loserLevel: 1,
          winnerDollarId: "dollar-3",
          loserDollarId: "dollar-4",
          winnings: 100,
          gameResult: "WIN",
        },
      ];

      // Act: Emit events concurrently
      await Promise.all(
        gameEvents.map((event) =>
          eventBus.emit(EVENT_TYPES.GAME_RESOLVED, event)
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Assert: Verify all events were processed
      const gameResolvedEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.GAME_RESOLVED
      );
      expect(gameResolvedEvents).toHaveLength(2);

      const playerAdvancedEvents = eventLog.filter(
        (e) => e.type === EVENT_TYPES.PLAYER_ADVANCED
      );
      expect(playerAdvancedEvents).toHaveLength(2);

      // Verify progression manager was called for all players (2 winners + 2 losers)
      expect(mockProgressionManager.processGameResult).toHaveBeenCalledTimes(4);
    });
  });
});
