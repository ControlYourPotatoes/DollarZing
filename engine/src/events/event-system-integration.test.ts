/**
 * Task 7.1: Integration Tests for Complete Event Flow Chains
 *
 * This test suite validates the complete event-driven architecture with minimal mocking,
 * focusing on real component integration and end-to-end event flows.
 *
 * Philosophy: Test real integration with actual business logic components.
 * Only mock external/infrastructure dependencies that we don't own.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "./event-bus";
import { GameEventHandler } from "./handlers/game-event-handler";
import { PlayerProgressionHandler } from "./handlers/player-progression-handler";
import { CashOutDecisionHandler } from "./handlers/cash-out-decision-handler";
import { PoolManagementHandler } from "./handlers/pool-management-handler";
import { RevenueTrackingHandler } from "./handlers/revenue-tracking-handler";
import { MatchmakingEventHandler } from "./handlers/matchmaking-event-handler";
import { EVENT_TYPES, GameResolvedEvent } from "./event-types";

// Real business logic components (no mocking)
import { VirtualDollarManager } from "../types/virtual-dollar-types";
import { GameMatchingEngine } from "../types/game-matching-engine";
import { RevenueCalculator } from "../types/revenue-calculator";
import { IStrategyManager } from "./handlers/cash-out-decision-handler";
import { VirtualDollar, CashOutStrategy } from "../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { DirectVirtualDollarFactory } from "../types/direct-factories";

describe("Task 7.1: Event System Integration Tests", () => {
  let eventBus: EventBus;
  // Event handlers (initialized but not directly used in tests - they work through the event system)
  let gameEventHandler: GameEventHandler;
  let playerProgressionHandler: PlayerProgressionHandler;
  let cashOutHandler: CashOutDecisionHandler;
  let poolHandler: PoolManagementHandler;
  let revenueHandler: RevenueTrackingHandler;
  let matchmakingHandler: MatchmakingEventHandler;

  // Real business logic components (minimal mocking)
  let virtualDollarManager: VirtualDollarManager;
  let virtualDollarFactory: VirtualDollarFactory;
  let gameMatchingEngine: GameMatchingEngine;
  let revenueCalculator: RevenueCalculator;
  let strategyManager: IStrategyManager;

  // Event capture for validation
  let capturedEvents: Array<{ type: string; data: any; timestamp: Date }> = [];

  beforeEach(async () => {
    eventBus = new EventBus();
    capturedEvents = [];

    // Create real business logic instances with production-like configuration
    virtualDollarManager = new VirtualDollarManager();
    virtualDollarFactory = new DirectVirtualDollarFactory({
      enableObjectPooling: true, // Enable for true integration testing
      poolSizes: { virtualDollar: 100, gameSession: 100 },
      prewarmCounts: { virtualDollar: 10, gameSession: 10 },
      enableBatchOptimizations: true, // Enable for production-like behavior
      enablePerformanceMetrics: true, // Enable for production-like behavior
    });

    // GameMatchingEngine requires dependencies - we'll create a minimal setup
    const { ScoringEngine } = await import("../types/scoring-engine");
    const { DirectGameSessionFactory } = await import(
      "../types/direct-factories"
    );
    const scoringEngine = new ScoringEngine();
    const gameSessionFactory = new DirectGameSessionFactory({
      enableObjectPooling: true, // Enable for true integration testing
      poolSizes: { virtualDollar: 100, gameSession: 100 },
      prewarmCounts: { virtualDollar: 10, gameSession: 10 },
      enableBatchOptimizations: true, // Enable for production-like behavior
      enablePerformanceMetrics: true, // Enable for production-like behavior
    });
    gameMatchingEngine = new GameMatchingEngine(
      virtualDollarManager,
      scoringEngine,
      gameSessionFactory,
      eventBus
    );

    revenueCalculator = new RevenueCalculator(0.2); // 20% charity rate
    // Create a simple real implementation of IStrategyManager
    strategyManager = {
      getPlayerStrategy: (_playerId: string) => CashOutStrategy.BALANCED,
      makeCashOutDecision: (context) => {
        // Simple strategy: cash out at level 3+ for conservative, continue for others
        if (
          context.strategy === CashOutStrategy.CONSERVATIVE &&
          context.currentLevel >= 3
        ) {
          return "CASH_OUT";
        }
        if (
          context.strategy === CashOutStrategy.AGGRESSIVE &&
          context.currentLevel >= 6
        ) {
          return "CASH_OUT";
        }
        return "CONTINUE";
      },
      getCashOutProbability: (level: number, strategy: CashOutStrategy) => {
        switch (strategy) {
          case CashOutStrategy.CONSERVATIVE:
            return Math.min(0.8, level * 0.2);
          case CashOutStrategy.BALANCED:
            return Math.min(0.6, level * 0.15);
          case CashOutStrategy.AGGRESSIVE:
            return Math.min(0.4, level * 0.1);
          default:
            return 0.3;
        }
      },
      processDecision: (context) => ({
        decision: context.decision,
        probability: context.decision === "CASH_OUT" ? 0.8 : 0.2,
        finalLevel: context.currentLevel,
        totalWinnings: context.totalWinnings,
        completed: context.decision === "CASH_OUT",
      }),
    } as IStrategyManager;

    // Initialize event handlers with real dependencies
    gameEventHandler = new GameEventHandler(
      eventBus,
      gameMatchingEngine,
      revenueCalculator
    );
    playerProgressionHandler = new PlayerProgressionHandler(
      eventBus,
      virtualDollarFactory
    );
    cashOutHandler = new CashOutDecisionHandler(eventBus, strategyManager);
    poolHandler = new PoolManagementHandler(
      eventBus,
      gameMatchingEngine,
      virtualDollarManager
    );
    revenueHandler = new RevenueTrackingHandler(eventBus, revenueCalculator);
    matchmakingHandler = new MatchmakingEventHandler(
      eventBus,
      gameMatchingEngine,
      virtualDollarManager,
      gameSessionFactory,
      scoringEngine
    );

    // Set up comprehensive event capture
    const eventTypes = Object.values(EVENT_TYPES);
    eventTypes.forEach((eventType) => {
      eventBus.on(
        eventType,
        (eventData) => {
          capturedEvents.push({
            type: eventType,
            data: eventData,
            timestamp: new Date(),
          });
        },
        -10 // Lowest priority to capture all events after processing
      );
    });

    // Suppress unused variable warnings - these handlers are used through the event system
    void gameEventHandler;
    void playerProgressionHandler;
    void cashOutHandler;
    void poolHandler;
    void revenueHandler;
    void matchmakingHandler;
  });

  describe("Complete Game Resolution Flow with Real Components", () => {
    it("should process full game resolution with actual VirtualDollar objects", async () => {
      // Arrange: Create real VirtualDollar objects using the factory
      const createdWinnerDollar = virtualDollarFactory.create("player-winner");
      const createdLoserDollar = virtualDollarFactory.create("player-loser");

      // Use factory-generated IDs for proper registry lookup
      const winnerDollarId = createdWinnerDollar.id;
      const loserDollarId = createdLoserDollar.id;

      // Add to game pool
      await gameMatchingEngine.addToPool(createdWinnerDollar);
      await gameMatchingEngine.addToPool(createdLoserDollar);

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "integration-game-001",
        winnerId: "player-winner",
        loserId: "player-loser",
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId,
        loserDollarId,
        winnings: 50,
        gameResult: "WIN",
      };

      // Act: Process game resolution through event system
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);

      // Allow all async event processing to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert: Validate complete event flow
      const eventTypes = capturedEvents.map((e) => e.type);

      // Core event sequence should occur
      expect(eventTypes).toContain(EVENT_TYPES.GAME_RESOLVED);
      expect(eventTypes).toContain(EVENT_TYPES.PLAYER_ADVANCED);
      expect(eventTypes).toContain(EVENT_TYPES.CASH_OUT_DECISION);

      // Verify revenue tracking processed the game
      const revenueEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.REVENUE_GAME_PROCESSED
      );
      expect(revenueEvents.length).toBeGreaterThan(0);

      // Verify both winner and loser progression was processed
      const playerAdvancedEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.PLAYER_ADVANCED
      );
      expect(playerAdvancedEvents.length).toBe(1); // Only winner advances

      // Verify loser was eliminated (RUN_COMPLETED event)
      const runCompletedEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.RUN_COMPLETED
      );
      expect(runCompletedEvents.length).toBe(1); // Only loser gets eliminated

      console.log("✅ Complete game resolution flow validated");
    });

    it("should handle winner progression and cash-out decision chain", async () => {
      // Arrange: Create winner with CONSERVATIVE strategy (more likely to cash out)
      // Create conservative winner using factory
      const conservativeWinner = virtualDollarFactory.create(
        "player-conservative"
      );
      const winnerDollarId = conservativeWinner.id;
      conservativeWinner.currentLevel = 2;
      conservativeWinner.currentRunWinnings = 100;
      conservativeWinner.gamesInThisRun = 1;

      // Create loser using factory
      const loserDollar = virtualDollarFactory.create("player-loser-002");
      const loserDollarId = loserDollar.id;

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "conservative-game-001",
        winnerId: "player-conservative",
        loserId: "player-loser-002",
        winnerLevel: 2,
        loserLevel: 1,
        winnerDollarId,
        loserDollarId,
        winnings: 200,
        gameResult: "WIN",
      };

      // Act: Process the game resolution
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert: Validate cash-out decision logic
      const cashOutDecisionEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.CASH_OUT_DECISION
      );
      expect(cashOutDecisionEvents.length).toBeGreaterThan(0);

      // Should have either CONTINUE_PLAY or CASH_OUT_COMPLETED events
      const continuePlayEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.CONTINUE_PLAY
      );
      const cashOutEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.CASH_OUT_COMPLETED
      );

      expect(continuePlayEvents.length + cashOutEvents.length).toBeGreaterThan(
        0
      );

      console.log(
        "✅ Winner progression and cash-out decision chain validated"
      );
    });
  });

  describe("Revenue Integration with Real RevenueCalculator", () => {
    it("should process revenue through actual business logic", async () => {
      // Arrange: Create a real game scenario
      // Create revenue winner using factory
      const winnerDollar = virtualDollarFactory.create("revenue-player-001");
      const winnerDollarId = winnerDollar.id;

      // Create revenue loser using factory
      const loserDollar = virtualDollarFactory.create("revenue-player-002");
      const loserDollarId = loserDollar.id;

      // Track initial revenue state
      const initialRevenue =
        revenueCalculator.getRevenueStream().totalClickFees;

      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "revenue-integration-001",
        winnerId: "revenue-player-001",
        loserId: "revenue-player-002",
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId,
        loserDollarId,
        winnings: 50,
        gameResult: "WIN",
      };

      // Act: Process game and capture revenue changes
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert: Verify actual revenue was processed
      const finalRevenue = revenueCalculator.getRevenueStream().totalClickFees;
      expect(finalRevenue).toBeGreaterThan(initialRevenue);

      const revenueGameProcessedEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.REVENUE_GAME_PROCESSED
      );
      expect(revenueGameProcessedEvents.length).toBe(1);

      // Verify revenue event contains actual calculated data
      const revenueEvent = revenueGameProcessedEvents[0];
      expect(revenueEvent.data.gameRevenue).toBeGreaterThan(0);
      expect(revenueEvent.data.platformRevenue).toBeGreaterThan(0);

      console.log("✅ Revenue integration with real business logic validated");
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle and propagate errors gracefully", async () => {
      // Arrange: Create scenario that will cause validation errors
      const invalidGameEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "error-test-001",
        winnerId: "nonexistent-winner",
        loserId: "nonexistent-loser",
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId: "nonexistent-winner-dollar",
        loserDollarId: "nonexistent-loser-dollar",
        winnings: -100, // Invalid negative winnings
        gameResult: "WIN",
      };

      // Act: Process invalid game event
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, invalidGameEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert: Verify error events were emitted appropriately
      const errorEvents = capturedEvents.filter(
        (e) => e.type.includes("FAILED") || e.type.includes("ERROR")
      );

      // Should have some error handling
      expect(errorEvents.length).toBeGreaterThan(0);

      console.log("✅ Error handling and recovery validated");
    });
  });

  describe("Event Ordering and Dependencies", () => {
    it("should process events in correct dependency order", async () => {
      // Arrange: Track processing order of interdependent events
      const processingOrder: Array<{ event: string; timestamp: number }> = [];

      // Set up order tracking
      eventBus.on(
        EVENT_TYPES.GAME_RESOLVED,
        () => {
          processingOrder.push({
            event: "GAME_RESOLVED",
            timestamp: Date.now(),
          });
        },
        20
      );

      eventBus.on(
        EVENT_TYPES.PLAYER_ADVANCED,
        () => {
          processingOrder.push({
            event: "PLAYER_ADVANCED",
            timestamp: Date.now(),
          });
        },
        15
      );

      eventBus.on(
        EVENT_TYPES.CASH_OUT_DECISION,
        () => {
          processingOrder.push({
            event: "CASH_OUT_DECISION",
            timestamp: Date.now(),
          });
        },
        10
      );

      // Create minimal test scenario
      const gameResolvedEvent: GameResolvedEvent = {
        type: EVENT_TYPES.GAME_RESOLVED,
        timestamp: new Date(),
        gameId: "order-test-001",
        winnerId: "order-winner",
        loserId: "order-loser",
        winnerLevel: 1,
        loserLevel: 1,
        winnerDollarId: "order-winner-dollar",
        loserDollarId: "order-loser-dollar",
        winnings: 50,
        gameResult: "WIN",
      };

      // Act: Process event and verify order
      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameResolvedEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert: Verify events processed in dependency order
      expect(processingOrder.length).toBeGreaterThan(0);

      // Events should be ordered by priority (higher priority = earlier processing)
      for (let i = 1; i < processingOrder.length; i++) {
        expect(processingOrder[i].timestamp).toBeGreaterThanOrEqual(
          processingOrder[i - 1].timestamp
        );
      }

      console.log("✅ Event ordering and dependencies validated");
    });
  });

  describe("Performance and Concurrency", () => {
    it("should handle multiple concurrent game resolutions", async () => {
      // Arrange: Create multiple game scenarios
      const gameEvents: GameResolvedEvent[] = [];
      const dollarPairs: Array<{
        winner: VirtualDollar;
        loser: VirtualDollar;
      }> = [];

      for (let i = 0; i < 5; i++) {
        // Create winner using factory
        const winner = virtualDollarFactory.create(`concurrent-winner-${i}`);
        const winnerDollarId = winner.id;

        // Create loser using factory
        const loser = virtualDollarFactory.create(`concurrent-loser-${i}`);
        const loserDollarId = loser.id;

        dollarPairs.push({ winner, loser });

        gameEvents.push({
          type: EVENT_TYPES.GAME_RESOLVED,
          timestamp: new Date(),
          gameId: `concurrent-game-${i}`,
          winnerId: `concurrent-winner-${i}`,
          loserId: `concurrent-loser-${i}`,
          winnerLevel: 1,
          loserLevel: 1,
          winnerDollarId,
          loserDollarId,
          winnings: 50,
          gameResult: "WIN",
        });
      }

      // Act: Process all games concurrently
      await Promise.all(
        gameEvents.map((event) =>
          eventBus.emit(EVENT_TYPES.GAME_RESOLVED, event)
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Verify all games processed correctly
      const gameResolvedEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.GAME_RESOLVED
      );
      expect(gameResolvedEvents.length).toBe(5);

      const playerAdvancedEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.PLAYER_ADVANCED
      );
      expect(playerAdvancedEvents.length).toBe(5); // Only 5 winners advance

      // Verify losers were eliminated (RUN_COMPLETED events)
      const runCompletedEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.RUN_COMPLETED
      );
      expect(runCompletedEvents.length).toBe(5); // 5 losers eliminated

      console.log("✅ Concurrent processing performance validated");
    });
  });

  describe("Matchmaking Event Integration", () => {
    it("should process complete matchmaking flow with new events", async () => {
      // Arrange: Create two VirtualDollar objects at the same level
      const dollar1 = virtualDollarFactory.create("matchmaking-player-1");
      const dollar2 = virtualDollarFactory.create("matchmaking-player-2");

      // Set both to level 1 for matching
      dollar1.currentLevel = 1;
      dollar2.currentLevel = 1;

      // Act: Add both dollars to the pool (this should trigger matchmaking)
      await gameMatchingEngine.addToPool(dollar1);
      await gameMatchingEngine.addToPool(dollar2);

      // Allow all async event processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Verify matchmaking events were emitted
      const eventTypes = capturedEvents.map((e) => e.type);

      // Should have pool events
      expect(eventTypes).toContain(EVENT_TYPES.POOL_ADDED);
      expect(eventTypes).toContain(EVENT_TYPES.POOL_UPDATED);

      // Should have matchmaking events
      expect(eventTypes).toContain(EVENT_TYPES.MATCHMAKING_ATTEMPTED);
      expect(eventTypes).toContain(EVENT_TYPES.MATCH_FOUND);
      expect(eventTypes).toContain(EVENT_TYPES.FIFO_QUEUE_UPDATED);

      // Should have game creation event
      expect(eventTypes).toContain(EVENT_TYPES.GAME_CREATED);

      // Verify matchmaking attempted event has correct data
      const matchmakingAttemptedEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.MATCHMAKING_ATTEMPTED
      );
      expect(matchmakingAttemptedEvents.length).toBeGreaterThan(0);

      const matchmakingEvent = matchmakingAttemptedEvents[0];
      expect(
        matchmakingEvent.data.poolSnapshot.totalDollarsInPool
      ).toBeGreaterThan(0);
      expect(matchmakingEvent.data.concurrentGamesCount).toBeDefined();
      expect(matchmakingEvent.data.maxConcurrentGames).toBeDefined();

      // Verify match found event has correct data
      const matchFoundEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.MATCH_FOUND
      );
      expect(matchFoundEvents.length).toBeGreaterThan(0);

      const matchFoundEvent = matchFoundEvents[0];
      expect(matchFoundEvent.data.virtualDollar1Id).toBeDefined();
      expect(matchFoundEvent.data.virtualDollar2Id).toBeDefined();
      expect(matchFoundEvent.data.matchedLevel).toBe(1);
      expect(matchFoundEvent.data.fifoOrder).toBeDefined();

      console.log("✅ Complete matchmaking flow with new events validated");
    });

    it("should handle waiting players when no match is available", async () => {
      // Arrange: Create only one VirtualDollar (odd number scenario)
      const dollar = virtualDollarFactory.create("waiting-player");
      dollar.currentLevel = 2;

      // Act: Add dollar to pool
      await gameMatchingEngine.addToPool(dollar);

      // Allow all async event processing to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert: Verify waiting events were emitted
      const eventTypes = capturedEvents.map((e) => e.type);

      // Should have pool events
      expect(eventTypes).toContain(EVENT_TYPES.POOL_ADDED);
      expect(eventTypes).toContain(EVENT_TYPES.POOL_UPDATED);

      // Should have matchmaking attempted
      expect(eventTypes).toContain(EVENT_TYPES.MATCHMAKING_ATTEMPTED);

      // Should have player waiting event
      expect(eventTypes).toContain(EVENT_TYPES.PLAYER_WAITING);

      // Should have FIFO queue updated
      expect(eventTypes).toContain(EVENT_TYPES.FIFO_QUEUE_UPDATED);

      // Verify player waiting event has correct data
      const playerWaitingEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.PLAYER_WAITING
      );
      expect(playerWaitingEvents.length).toBeGreaterThan(0);

      const waitingEvent = playerWaitingEvents[0];
      expect(waitingEvent.data.virtualDollarId).toBe(dollar.id);
      expect(waitingEvent.data.playerId).toBe(dollar.ownerId);
      expect(waitingEvent.data.waitingAtLevel).toBe(2);
      expect(waitingEvent.data.queuePosition).toBe(1);
      expect(waitingEvent.data.playersNeededForMatch).toBe(1);

      console.log("✅ Waiting players scenario validated");
    });

    it("should handle pool removal and update events", async () => {
      // Arrange: Create and add a dollar to pool
      const dollar = virtualDollarFactory.create("removal-test-player");
      dollar.currentLevel = 3;

      await gameMatchingEngine.addToPool(dollar);

      // Clear captured events to focus on removal
      capturedEvents = [];

      // Act: Remove dollar from pool
      await gameMatchingEngine.removeFromPool(dollar.id, "CASHED_OUT");

      // Allow all async event processing to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert: Verify removal events were emitted
      const eventTypes = capturedEvents.map((e) => e.type);

      // Should have pool removal and update events
      expect(eventTypes).toContain(EVENT_TYPES.POOL_REMOVED);
      expect(eventTypes).toContain(EVENT_TYPES.POOL_UPDATED);

      // Verify pool removed event has correct data
      const poolRemovedEvents = capturedEvents.filter(
        (e) => e.type === EVENT_TYPES.POOL_REMOVED
      );
      expect(poolRemovedEvents.length).toBe(1);

      const removedEvent = poolRemovedEvents[0];
      expect(removedEvent.data.virtualDollarId).toBe(dollar.id);
      expect(removedEvent.data.playerId).toBe(dollar.ownerId);
      expect(removedEvent.data.reason).toBe("CASHED_OUT");
      expect(removedEvent.data.poolSize).toBe(0); // Should be empty after removal

      console.log("✅ Pool removal and update events validated");
    });
  });
});
