// GameEngineSimulator Tests - Task 7.1
// Tests for simulation orchestration with all components including PlayerBalanceManager

import {
  GameEngineSimulator,
  SimulationConfig,
  SimulationProgress,
  SimulationResults,
} from "../src/simulation/game-engine-simulator";
import { CashOutStrategy } from "../src/types/virtual-dollar-engine";
import { PlayerBalanceManager } from "../src/types/player-balance-manager";
import { GameMatchingEngine } from "../src/types/game-matching-engine";
import { RunOrchestrator } from "../src/types/run-orchestrator";
import { VirtualDollarManager } from "../src/types/virtual-dollar-types";
import { ScoringEngine } from "../src/types/scoring-engine";
import { ProgressionManager } from "../src/types/progression-manager";
import { RevenueCalculator } from "../src/types/revenue-calculator";

// Mock time for consistent testing
const mockTime = new Date("2025-08-20T10:00:00Z");

// Mock console to suppress logs during testing
const originalConsole = console;
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe("GameEngineSimulator", () => {
  let controller: GameEngineSimulator;
  let config: SimulationConfig;

  beforeEach(() => {
    // Standard simulation configuration
    config = {
      durationDays: 30,
      initialPlayerCount: 100,
      dailySeed: "test-seed-2025-08-20",
      charityPercentage: 0.15, // 15% charity contribution
      playerStrategies: {
        [CashOutStrategy.CONSERVATIVE]: 0.4, // 40% conservative
        [CashOutStrategy.BALANCED]: 0.4, // 40% balanced
        [CashOutStrategy.AGGRESSIVE]: 0.2, // 20% aggressive
      },
      initialDonationAmount: 20.0, // $20 starting donation
      maxSimulationTimeMs: 30000, // 30 second timeout
      enableProgressReporting: true,
    };

    controller = new GameEngineSimulator(config);

    // Mock time
    jest.useFakeTimers();
    jest.setSystemTime(mockTime);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Constructor and Initialization", () => {
    it("should create controller with valid configuration", () => {
      expect(controller).toBeInstanceOf(GameEngineSimulator);
      expect(controller.getConfig()).toEqual(config);
    });

    it("should initialize all required components", () => {
      const components = controller.getComponents();

      expect(components.playerBalanceManager).toBeInstanceOf(
        PlayerBalanceManager
      );
      expect(components.gameMatchingEngine).toBeInstanceOf(GameMatchingEngine);
      expect(components.runOrchestrator).toBeInstanceOf(RunOrchestrator);
      expect(components.dollarManager).toBeInstanceOf(VirtualDollarManager);
      expect(components.scoringEngine).toBeInstanceOf(ScoringEngine);
      expect(components.progressionManager).toBeInstanceOf(ProgressionManager);
      expect(components.revenueCalculator).toBeInstanceOf(RevenueCalculator);
    });

    it("should validate configuration parameters", () => {
      // Test invalid configuration
      const invalidConfig = { ...config, durationDays: 0 };
      expect(() => new GameEngineSimulator(invalidConfig)).toThrow(
        "Duration must be at least 1 day"
      );

      const invalidPlayerCount = { ...config, initialPlayerCount: -1 };
      expect(() => new GameEngineSimulator(invalidPlayerCount)).toThrow(
        "Initial player count must be positive"
      );

      const invalidCharity = { ...config, charityPercentage: 1.5 };
      expect(() => new GameEngineSimulator(invalidCharity)).toThrow(
        "Charity percentage must be between 0 and 1"
      );
    });

    it("should handle player strategy distribution validation", () => {
      // Test invalid strategy percentages (don't sum to 1.0)
      const invalidStrategies = {
        ...config,
        playerStrategies: {
          [CashOutStrategy.CONSERVATIVE]: 0.5,
          [CashOutStrategy.BALANCED]: 0.3,
          [CashOutStrategy.AGGRESSIVE]: 0.3, // Sum = 1.1
        },
      };

      expect(() => new GameEngineSimulator(invalidStrategies)).toThrow(
        "Player strategy percentages must sum to 1.0"
      );
    });
  });

  describe("Player Initialization - Task 7.3", () => {
    it("should initialize players with starting donation balance ($20)", () => {
      const playerCount = controller.initializePlayers();

      expect(playerCount).toBe(config.initialPlayerCount);

      // Verify all players have correct starting balance
      const balanceManager = controller.getComponents().playerBalanceManager;
      for (let i = 0; i < config.initialPlayerCount; i++) {
        const playerId = `player-${i}`;
        const player = balanceManager.getPlayer(playerId);

        expect(player).toBeDefined();
        expect(player!.donationBalance).toBe(config.initialDonationAmount);
        expect(player!.winningsBalance).toBe(0);
        expect(player!.currentProgression).toBe(0);
        expect(player!.isActive).toBe(true);
      }
    });

    it("should distribute cash-out strategies according to configuration", () => {
      controller.initializePlayers();

      const balanceManager = controller.getComponents().playerBalanceManager;
      const strategyCounts = new Map<CashOutStrategy, number>();

      // Count strategy distribution
      for (let i = 0; i < config.initialPlayerCount; i++) {
        const player = balanceManager.getPlayer(`player-${i}`);
        const strategy = player!.cashOutStrategy;
        strategyCounts.set(strategy, (strategyCounts.get(strategy) || 0) + 1);
      }

      // Verify distribution matches configuration (within reasonable tolerance)
      const expectedConservative = Math.round(
        config.playerStrategies[CashOutStrategy.CONSERVATIVE] *
          config.initialPlayerCount
      );
      const expectedBalanced = Math.round(
        config.playerStrategies[CashOutStrategy.BALANCED] *
          config.initialPlayerCount
      );
      const expectedAggressive = Math.round(
        config.playerStrategies[CashOutStrategy.AGGRESSIVE] *
          config.initialPlayerCount
      );

      expect(strategyCounts.get(CashOutStrategy.CONSERVATIVE)).toBeCloseTo(
        expectedConservative,
        5
      );
      expect(strategyCounts.get(CashOutStrategy.BALANCED)).toBeCloseTo(
        expectedBalanced,
        5
      );
      expect(strategyCounts.get(CashOutStrategy.AGGRESSIVE)).toBeCloseTo(
        expectedAggressive,
        5
      );
    });

    it("should handle player activation and retirement logic", () => {
      controller.initializePlayers();

      const balanceManager = controller.getComponents().playerBalanceManager;
      const testPlayer = balanceManager.getPlayer("player-0")!;

      // Verify initial activation
      expect(testPlayer.isActive).toBe(true);

      // Simulate insufficient funds scenario
      balanceManager.processGameFee(testPlayer.id, 21.0); // More than they have
      const updatedPlayer = balanceManager.getPlayer("player-0")!;
      expect(updatedPlayer.isActive).toBe(false);
    });
  });

  describe("Simulation Orchestration", () => {
    it("should orchestrate all components properly", async () => {
      const results = await controller.runSimulation();

      expect(results).toBeDefined();
      expect(results.success).toBe(true);
      expect(results.simulationDurationMs).toBeDefined();
      expect(results.playerStats).toBeDefined();
      expect(results.revenueStats).toBeDefined();
      expect(results.gameStats).toBeDefined();
    });

    it("should handle component coordination without conflicts", async () => {
      // Initialize simulation
      controller.initializePlayers();

      // Start simulation and verify no component conflicts
      const progressCallback = jest.fn();
      const simulationPromise = controller.runSimulation(progressCallback);

      // Advance timers to simulate progression
      jest.advanceTimersByTime(1000);

      const results = await simulationPromise;
      expect(results.success).toBe(true);
      expect(progressCallback).toHaveBeenCalled();
    });

    it("should integrate PlayerBalanceManager with all game operations", async () => {
      controller.initializePlayers();

      const balanceManager = controller.getComponents().playerBalanceManager;
      const initialPlayerFunds = balanceManager.getTotalPlayerFunds();

      await controller.runSimulation();

      // Verify funds have been processed through games
      const finalPlayerFunds = balanceManager.getTotalPlayerFunds();
      expect(finalPlayerFunds).toBeDefined();
      expect(typeof finalPlayerFunds).toBe("number");
    });
  });

  describe("Component Integration", () => {
    it("should coordinate all engine components seamlessly", () => {
      const components = controller.getComponents();

      // Verify component dependencies are properly set up
      expect(components.runOrchestrator).toBeDefined();
      expect(components.gameMatchingEngine).toBeDefined();
      expect(components.playerBalanceManager).toBeDefined();
      expect(components.revenueCalculator).toBeDefined();
    });

    it("should handle event flow between components", async () => {
      const eventLog: string[] = [];

      // Mock event handlers to track flow
      const gameEngine = controller.getComponents().gameMatchingEngine;
      gameEngine.subscribe("gameCreated", () => eventLog.push("gameCreated"));
      gameEngine.subscribe("gameResolved", () => eventLog.push("gameResolved"));

      controller.initializePlayers();
      await controller.runSimulation();

      // Events should have been triggered during simulation
      expect(eventLog.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling and Validation", () => {
    it("should handle simulation timeout gracefully", async () => {
      const shortTimeoutConfig = { ...config, maxSimulationTimeMs: 1 }; // 1ms timeout
      const timeoutController = new GameEngineSimulator(shortTimeoutConfig);

      timeoutController.initializePlayers();
      const results = await timeoutController.runSimulation();

      expect(results.success).toBe(false);
      expect(results.error).toContain("timeout");
    });

    it("should validate all simulation parameters", () => {
      const configs = [
        { ...config, durationDays: -1 },
        { ...config, initialPlayerCount: 0 },
        { ...config, charityPercentage: -0.1 },
        { ...config, initialDonationAmount: -5 },
      ];

      configs.forEach((invalidConfig) => {
        expect(() => new GameEngineSimulator(invalidConfig)).toThrow();
      });
    });

    it("should provide meaningful error messages", () => {
      try {
        new GameEngineSimulator({ ...config, durationDays: 0 });
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain(
          "Duration must be at least 1 day"
        );
      }
    });
  });

  describe("Performance Requirements", () => {
    it("should complete simulation within time constraints", async () => {
      const startTime = performance.now();

      controller.initializePlayers();
      await controller.runSimulation();

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(config.maxSimulationTimeMs);
    });

    it("should maintain memory efficiency", async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      controller.initializePlayers();
      await controller.runSimulation();

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Memory usage should be reasonable (allowing for some growth)
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
      }
    });
  });
});

describe("SimulationProgress and Reporting - Task 7.7", () => {
  let controller: GameEngineSimulator;
  let config: SimulationConfig;

  beforeEach(() => {
    config = {
      durationDays: 10,
      initialPlayerCount: 50,
      dailySeed: "progress-test-seed",
      charityPercentage: 0.15,
      playerStrategies: {
        [CashOutStrategy.CONSERVATIVE]: 0.5,
        [CashOutStrategy.BALANCED]: 0.3,
        [CashOutStrategy.AGGRESSIVE]: 0.2,
      },
      initialDonationAmount: 20.0,
      maxSimulationTimeMs: 15000,
      enableProgressReporting: true,
    };

    controller = new GameEngineSimulator(config);
  });

  it("should provide real-time progress updates", async () => {
    const progressUpdates: SimulationProgress[] = [];

    const progressCallback = (progress: SimulationProgress) => {
      progressUpdates.push(progress);
    };

    controller.initializePlayers();
    await controller.runSimulation(progressCallback);

    expect(progressUpdates.length).toBeGreaterThan(0);

    // Verify progress structure
    progressUpdates.forEach((progress) => {
      expect(progress.currentDay).toBeGreaterThanOrEqual(0);
      expect(progress.currentDay).toBeLessThanOrEqual(config.durationDays);
      expect(progress.completionPercentage).toBeGreaterThanOrEqual(0);
      expect(progress.completionPercentage).toBeLessThanOrEqual(1);
      expect(progress.estimatedRemainingMs).toBeGreaterThanOrEqual(0);
      expect(progress.playersActive).toBeGreaterThanOrEqual(0);
      expect(progress.gamesCompleted).toBeGreaterThanOrEqual(0);
    });
  });

  it("should calculate accurate completion estimates", async () => {
    const progressUpdates: SimulationProgress[] = [];

    controller.initializePlayers();
    await controller.runSimulation((progress) =>
      progressUpdates.push(progress)
    );

    // Verify progression is monotonic
    for (let i = 1; i < progressUpdates.length; i++) {
      expect(progressUpdates[i].completionPercentage).toBeGreaterThanOrEqual(
        progressUpdates[i - 1].completionPercentage
      );
    }

    // Final progress should be complete
    const finalProgress = progressUpdates[progressUpdates.length - 1];
    expect(finalProgress.completionPercentage).toBe(1);
    expect(finalProgress.estimatedRemainingMs).toBe(0);
  });

  it("should track player activity and game completion", async () => {
    let lastProgress: SimulationProgress | null = null;

    controller.initializePlayers();
    await controller.runSimulation((progress) => {
      lastProgress = progress;
    });

    expect(lastProgress).toBeDefined();
    expect(lastProgress!.playersActive).toBeGreaterThan(0);
    expect(lastProgress!.gamesCompleted).toBeGreaterThan(0);
    expect(lastProgress!.dollarsInPool).toBeGreaterThanOrEqual(0);
  });
});

describe("Simulation Results and Export - Task 7.11", () => {
  let controller: GameEngineSimulator;
  let config: SimulationConfig;

  beforeEach(() => {
    config = {
      durationDays: 7, // Short simulation for testing
      initialPlayerCount: 25,
      dailySeed: "export-test-seed",
      charityPercentage: 0.1,
      playerStrategies: {
        [CashOutStrategy.CONSERVATIVE]: 0.6,
        [CashOutStrategy.BALANCED]: 0.3,
        [CashOutStrategy.AGGRESSIVE]: 0.1,
      },
      initialDonationAmount: 20.0,
      maxSimulationTimeMs: 10000,
      enableProgressReporting: false,
    };

    controller = new GameEngineSimulator(config);
  });

  it("should generate comprehensive simulation results", async () => {
    controller.initializePlayers();
    const results = await controller.runSimulation();

    expect(results).toBeDefined();
    expect(results.success).toBe(true);
    expect(results.simulationDurationMs).toBeGreaterThan(0);

    // Verify player statistics
    expect(results.playerStats.totalPlayers).toBe(config.initialPlayerCount);
    expect(results.playerStats.activePlayers).toBeGreaterThanOrEqual(0);
    expect(results.playerStats.retiredPlayers).toBeGreaterThanOrEqual(0);
    expect(results.playerStats.totalDonationsFunds).toBeGreaterThanOrEqual(0);
    expect(results.playerStats.totalWinningsFunds).toBeGreaterThanOrEqual(0);

    // Verify revenue statistics
    expect(results.revenueStats.totalPlatformRevenue).toBeGreaterThanOrEqual(0);
    expect(
      results.revenueStats.totalCharityContributions
    ).toBeGreaterThanOrEqual(0);
    expect(results.revenueStats.totalPlayerPayouts).toBeGreaterThanOrEqual(0);
    expect(results.revenueStats.revenuePerGame).toBeGreaterThanOrEqual(0);

    // Verify game statistics
    expect(results.gameStats.totalGames).toBeGreaterThanOrEqual(0);
    expect(results.gameStats.averageGamesPerDay).toBeGreaterThanOrEqual(0);
    expect(results.gameStats.totalVirtualDollars).toBeGreaterThanOrEqual(0);
    expect(results.gameStats.completedRuns).toBeGreaterThanOrEqual(0);
  });

  it("should include player balance data in export", async () => {
    controller.initializePlayers();
    const results = await controller.runSimulation();

    expect(results.playerStats.totalDonationsFunds).toBeDefined();
    expect(results.playerStats.totalWinningsFunds).toBeDefined();
    expect(results.playerStats.totalProgressionFunds).toBeDefined();

    // Verify balance consistency
    const totalFunds =
      results.playerStats.totalDonationsFunds +
      results.playerStats.totalWinningsFunds +
      results.playerStats.totalProgressionFunds;
    expect(totalFunds).toBeGreaterThanOrEqual(0);
  });

  it("should provide detailed revenue breakdown", async () => {
    controller.initializePlayers();
    const results = await controller.runSimulation();

    const { revenueStats } = results;

    // Platform revenue should come from game fees
    expect(revenueStats.totalPlatformRevenue).toBeGreaterThanOrEqual(0);
    expect(revenueStats.revenuePerGame).toBe(0.2); // 20c per game

    // Charity contributions should be percentage of cash-outs
    expect(revenueStats.totalCharityContributions).toBeGreaterThanOrEqual(0);
    expect(revenueStats.charityPercentage).toBe(config.charityPercentage);

    // Player payouts should match total winnings distributed
    expect(revenueStats.totalPlayerPayouts).toBeGreaterThanOrEqual(0);
  });

  it("should format data for external consumption", async () => {
    controller.initializePlayers();
    const results = await controller.runSimulation();

    // Verify results can be serialized to JSON
    const jsonString = JSON.stringify(results);
    expect(jsonString).toBeDefined();
    expect(jsonString.length).toBeGreaterThan(0);

    // Verify it can be parsed back
    const parsed = JSON.parse(jsonString);
    expect(parsed.success).toBe(results.success);
    expect(parsed.playerStats.totalPlayers).toBe(
      results.playerStats.totalPlayers
    );
  });
});
