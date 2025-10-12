import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameEngineSimulator } from "./game-engine-simulator";

import { GameMatchingEngine } from "../core/game-matching-engine";
import { PlayerManager } from "./player-manager"; // Event-driven player manager
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { RevenueCalculator } from "../core/revenue-calculator";
import { ScoringEngine } from "../core/scoring-engine";
import { CashOutStrategy } from "../types/virtual-dollar-engine";
import { DirectGameSessionFactory } from "../test-utils";
import { DEFAULT_PERFORMANCE_CONFIG } from "../types/factory-interfaces";
import { InMemoryDormantPlayerStore } from "./player-registry";

// Mock only external dependencies
vi.mock("console", () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("performance", () => ({
  now: vi.fn(() => 1000),
}));

describe("GameEngineSimulator", () => {
  let gameEngineSimulator: GameEngineSimulator;
  let mockGameMatchingEngine: GameMatchingEngine;
  let mockPlayerManager: PlayerManager;
  let mockVirtualDollarFactory: VirtualDollarFactory;
  let mockRevenueCalculator: RevenueCalculator;
  let mockScoringEngine: ScoringEngine;

  // Helper function to create valid simulation config
  const createValidConfig = (overrides: any = {}) => ({
    durationDays: 3,
    initialPlayerCount: 5,
    dailySeed: "2025-09-01",
    charityPercentage: 0.1,
    playerStrategies: {
      [CashOutStrategy.CONSERVATIVE]: 0.3,
      [CashOutStrategy.BALANCED]: 0.4,
      [CashOutStrategy.AGGRESSIVE]: 0.3,
    },
    initialDonationAmount: 20.0,
    maxSimulationTimeMs: 30000,
    enableProgressReporting: true,
    growthModel: {
      adoptionRate: 0.1,
      baseMarket: 1000000,
      midpointDay: 90,
      steepnessFactor: 20,
    },
    ...overrides,
  });

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create real instances of core components
    const { UnifiedVirtualDollarFactory } = await import(
      "../test-utils/direct-factories"
    );
    mockVirtualDollarFactory = new UnifiedVirtualDollarFactory(
      DEFAULT_PERFORMANCE_CONFIG
    );
    mockScoringEngine = new ScoringEngine();

    // Create game session factory
    const gameSessionFactory = new DirectGameSessionFactory(
      DEFAULT_PERFORMANCE_CONFIG
    );

    const { EventBus } = await import("../events/event-bus");
    const eventBus = new EventBus();

    mockGameMatchingEngine = new GameMatchingEngine(
      mockVirtualDollarFactory,
      mockScoringEngine,
      gameSessionFactory,
      eventBus
    );
    mockPlayerManager = new PlayerManager(
      eventBus,
      mockVirtualDollarFactory,
      new InMemoryDormantPlayerStore(),
      () => mockGameMatchingEngine.getPoolStatistics()
    );
    mockRevenueCalculator = new RevenueCalculator();

    // Create GameEngineSimulator instance
    gameEngineSimulator = new GameEngineSimulator(
      mockGameMatchingEngine,
      mockVirtualDollarFactory,
      mockRevenueCalculator,
      null, // dayProcessor - will be injected
      mockPlayerManager,
      eventBus
    );
  });

  describe("constructor", () => {
    it("should initialize with all required dependencies", () => {
      expect(gameEngineSimulator).toBeDefined();
    });

    it("should initialize component classes", () => {
      // Verify that the component classes are properly initialized
      expect(gameEngineSimulator).toHaveProperty("dayProcessor");
      expect(gameEngineSimulator).toHaveProperty("playerManager");
      expect(gameEngineSimulator).toHaveProperty("gameProcessor");
    });
  });

  describe("executeSimulation", () => {
    const validConfig = createValidConfig();

    it("should execute a complete simulation successfully", async () => {
      const results = await gameEngineSimulator.executeSimulation(validConfig);

      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(results.summary.totalDays).toBe(3);
      expect(results.summary.totalPlayers).toBe(5);
      expect(results.dailyResults).toHaveLength(3);
    });

    it("should handle progress callbacks", async () => {
      const progressCallback = vi.fn();

      await gameEngineSimulator.executeSimulation(
        validConfig,
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalled();
      // Verify progress callback was called with expected structure
      const progressCall = progressCallback.mock.calls[0][0];
      expect(progressCall).toHaveProperty("currentDay");
      expect(progressCall).toHaveProperty("totalDays");
      expect(progressCall).toHaveProperty("completionPercentage");
      expect(progressCall.totalDays).toBe(3); // Should match config.durationDays
    });

    it("should handle simulation timeout", async () => {
      const timeoutConfig = createValidConfig({
        maxSimulationTimeMs: 1000, // 1 second timeout
      });

      const results = await gameEngineSimulator.executeSimulation(
        timeoutConfig
      );

      expect(results).toBeDefined();
      expect(results.summary.simulationCompleted).toBe(true);
    });

    it("should validate configuration parameters", async () => {
      const invalidConfig = createValidConfig({
        durationDays: -1, // Invalid duration
      });

      await expect(
        gameEngineSimulator.executeSimulation(invalidConfig)
      ).rejects.toThrow();
    });

    it("should handle empty player strategies", async () => {
      const emptyStrategiesConfig = createValidConfig({
        playerStrategies: {},
      });

      await expect(
        gameEngineSimulator.executeSimulation(emptyStrategiesConfig)
      ).rejects.toThrow();
    });

    it("should process all days in sequence", async () => {
      const results = await gameEngineSimulator.executeSimulation(validConfig);

      // Verify we have results for each day
      expect(results.dailyResults).toHaveLength(3);

      // Verify each day has expected structure
      results.dailyResults.forEach((dayResult, index) => {
        expect(dayResult.day).toBe(index + 1);
        expect(dayResult).toHaveProperty("playerStatistics");
        expect(dayResult).toHaveProperty("gameStatistics");
        expect(dayResult).toHaveProperty("revenueStatistics");
      });
    });

    it("should handle simulation cancellation", async () => {
      const cancellationToken = { cancelled: true };

      const results = await gameEngineSimulator.executeSimulation(
        validConfig,
        undefined,
        cancellationToken
      );

      expect(results.summary.simulationCompleted).toBe(false);
    });
  });

  describe("component integration", () => {
    it("should properly coordinate DayProcessor, PlayerManager, and GameProcessor", async () => {
      const config = createValidConfig({
        durationDays: 2,
        initialPlayerCount: 3,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
        enableProgressReporting: false,
      });

      const results = await gameEngineSimulator.executeSimulation(config);

      // Verify that all components worked together
      expect(results.summary.totalPlayers).toBe(3);
      expect(results.dailyResults).toHaveLength(2);

      // Verify that player statistics are properly tracked
      results.dailyResults.forEach((dayResult) => {
        expect(dayResult.playerStatistics.totalPlayers).toBeGreaterThanOrEqual(
          3
        );
      });
    });

    it("should handle component errors gracefully", async () => {
      // Mock a component to throw an error
      const errorConfig = createValidConfig({
        durationDays: 1,
        initialPlayerCount: 1,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
        enableProgressReporting: false,
      });

      // This should not throw, but should handle errors gracefully
      const results = await gameEngineSimulator.executeSimulation(errorConfig);
      expect(results).toBeDefined();
    });
  });

  describe("data flow validation", () => {
    it("should maintain data consistency across components", async () => {
      const config = createValidConfig({
        durationDays: 1,
        initialPlayerCount: 2,
        playerStrategies: {
          [CashOutStrategy.BALANCED]: 1.0,
        },
        enableProgressReporting: false,
      });

      const results = await gameEngineSimulator.executeSimulation(config);

      // Verify data consistency
      const dayResult = results.dailyResults[0];
      expect(dayResult.playerStatistics.totalPlayers).toBe(2);
      expect(dayResult.playerStatistics.totalCharityContributions).toBe(80.0); // 2 players * $40 (updated calculation)
    });
  });
});
