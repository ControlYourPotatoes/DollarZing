// Game Engine Integration Tests for Dataset Orchestrator
// Tests real game engine parameter injection and configuration

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  GameEngineSimulator,
  SimulationConfig,
} from "../src/simulation/game-engine-simulator";
import { CashOutStrategy } from "../src/types/virtual-dollar-engine";
import type {
  ParameterCombination,
  DatasetGenerationResult,
  OrchestratorConfig,
} from "../src/orchestrator/types";
import {
  generateAllCombinations,
  validateParameterCombination,
} from "../src/orchestrator/parameter-matrix";

describe("Orchestrator Game Engine Integration", () => {
  let defaultSimulationConfig: SimulationConfig;
  let defaultOrchestratorConfig: OrchestratorConfig;

  beforeEach(() => {
    // Default configuration for testing
    defaultSimulationConfig = {
      durationDays: 30,
      initialPlayerCount: 100,
      dailySeed: "test-seed",
      charityPercentage: 0.2, // 20%
      playerStrategies: {
        low: 0.4,
        average: 0.4,
        high: 0.2,
      },
      initialDonationAmount: 50,
      maxSimulationTimeMs: 60000, // 1 minute max for tests
      enableProgressReporting: false,
    };

    defaultOrchestratorConfig = {
      outputDirectory: "test-generated-datasets",
      generateMetadata: true,
      batchSize: 1,
      timeoutPerDataset: 30000, // 30 seconds per dataset
      enableProgressReporting: false,
      enableValidation: true,
      verbose: false,
      dryRun: false,
    };
  });

  afterEach(() => {
    // Cleanup any test artifacts
  });

  describe("Parameter Injection Integration", () => {
    it("should create GameEngineSimulator with orchestrator parameters", async () => {
      // Test parameter combination
      const testCombination: ParameterCombination = {
        growthRate: 35,
        riskLevel: "mid",
        charityPercentage: 20,
      };

      // Validate parameter combination
      expect(validateParameterCombination(testCombination)).toBe(true);

      // Create simulation config based on orchestrator parameters
      const simulationConfig: SimulationConfig = {
        ...defaultSimulationConfig,
        charityPercentage: testCombination.charityPercentage / 100, // Convert to decimal
        playerStrategies: mapRiskLevelToStrategy(testCombination.riskLevel),
        durationDays: 7, // Shorter for integration tests
      };

      // Create and validate simulation controller
      const controller = new GameEngineSimulator(simulationConfig);
      expect(controller.getConfig().charityPercentage).toBe(0.2);
      expect(controller.getConfig().playerStrategies).toEqual(
        mapRiskLevelToStrategy("mid")
      );
    });

    it("should validate all parameter combinations can create valid simulation configs", () => {
      const allCombinations = generateAllCombinations();
      expect(allCombinations).toHaveLength(27); // 3x3x3 = 27 combinations

      // Test each combination can create a valid simulation config
      allCombinations.forEach((combination, index) => {
        expect(validateParameterCombination(combination)).toBe(true);

        const simulationConfig: SimulationConfig = {
          ...defaultSimulationConfig,
          charityPercentage: combination.charityPercentage / 100,
          playerStrategies: mapRiskLevelToStrategy(combination.riskLevel),
          dailySeed: `test-seed-${index}`, // Unique seed per combination
        };

        // Should not throw when creating controller
        expect(() => new GameEngineSimulator(simulationConfig)).not.toThrow();
      });
    });

    it("should map orchestrator risk levels to cash-out strategies correctly", () => {
      const lowRiskStrategy = mapRiskLevelToStrategy("low");
      const midRiskStrategy = mapRiskLevelToStrategy("mid");
      const highRiskStrategy = mapRiskLevelToStrategy("high");

      // Low risk should favor conservative (low) cash-out strategy
      expect(lowRiskStrategy.low).toBeGreaterThan(lowRiskStrategy.high);

      // Mid risk should be balanced
      expect(midRiskStrategy.low).toBeLessThan(0.5);
      expect(midRiskStrategy.high).toBeLessThan(0.5);
      expect(midRiskStrategy.average).toBeGreaterThan(0.3);

      // High risk should favor aggressive (high) cash-out strategy
      expect(highRiskStrategy.high).toBeGreaterThan(highRiskStrategy.low);

      // All strategies should sum to 1.0
      expect(
        Object.values(lowRiskStrategy).reduce((a, b) => a + b, 0)
      ).toBeCloseTo(1.0);
      expect(
        Object.values(midRiskStrategy).reduce((a, b) => a + b, 0)
      ).toBeCloseTo(1.0);
      expect(
        Object.values(highRiskStrategy).reduce((a, b) => a + b, 0)
      ).toBeCloseTo(1.0);
    });

    it("should handle growth rate parameter in simulation initialization", () => {
      const testCombination: ParameterCombination = {
        growthRate: 60,
        riskLevel: "high",
        charityPercentage: 30,
      };

      // For now, growth rate affects initial player count
      // This is a simplified mapping - real implementation would be more sophisticated
      const basePlayerCount = 100;
      const adjustedPlayerCount = Math.round(
        basePlayerCount * (testCombination.growthRate / 35)
      );

      const simulationConfig: SimulationConfig = {
        ...defaultSimulationConfig,
        initialPlayerCount: adjustedPlayerCount,
        charityPercentage: testCombination.charityPercentage / 100,
        playerStrategies: mapRiskLevelToStrategy(testCombination.riskLevel),
      };

      const controller = new GameEngineSimulator(simulationConfig);
      expect(controller.getConfig().initialPlayerCount).toBe(
        adjustedPlayerCount
      );
    });
  });

  describe("Real Game Engine Execution", () => {
    it("should successfully run a short simulation with orchestrator parameters", async () => {
      const testCombination: ParameterCombination = {
        growthRate: 15,
        riskLevel: "low",
        charityPercentage: 10,
      };

      const simulationConfig: SimulationConfig = {
        ...defaultSimulationConfig,
        durationDays: 3, // Very short for integration test
        initialPlayerCount: 20, // Small player count for speed
        charityPercentage: testCombination.charityPercentage / 100,
        playerStrategies: mapRiskLevelToStrategy(testCombination.riskLevel),
        maxSimulationTimeMs: 10000, // 10 seconds max
      };

      const controller = new GameEngineSimulator(simulationConfig);

      // Initialize players
      const playersCreated = controller.initializePlayers();
      expect(playersCreated).toBe(20);

      // Run simulation
      const results = await controller.runSimulation();

      // Verify successful execution
      expect(results.success).toBe(true);
      expect(results.error).toBeUndefined();
      expect(results.config.charityPercentage).toBe(0.1);
      expect(results.playerStats.totalPlayers).toBe(20);
      expect(results.revenueStats.charityPercentage).toBe(0.1);
    }, 15000); // 15 second timeout

    it("should generate different results for different parameter combinations", async () => {
      const combination1: ParameterCombination = {
        growthRate: 15,
        riskLevel: "low",
        charityPercentage: 10,
      };

      const combination2: ParameterCombination = {
        growthRate: 60,
        riskLevel: "high",
        charityPercentage: 30,
      };

      // Create simulation configs for both combinations
      const config1 = createSimulationConfig(combination1);
      const config2 = createSimulationConfig(combination2);

      const controller1 = new GameEngineSimulator(config1);
      const controller2 = new GameEngineSimulator(config2);

      controller1.initializePlayers();
      controller2.initializePlayers();

      // Run both simulations
      const [results1, results2] = await Promise.all([
        controller1.runSimulation(),
        controller2.runSimulation(),
      ]);

      // Both should succeed
      expect(results1.success).toBe(true);
      expect(results2.success).toBe(true);

      // But should have different charity percentages
      expect(results1.revenueStats.charityPercentage).toBe(0.1);
      expect(results2.revenueStats.charityPercentage).toBe(0.3);

      // And different player counts (due to growth rate)
      expect(results1.playerStats.totalPlayers).not.toBe(
        results2.playerStats.totalPlayers
      );
    }, 30000); // 30 second timeout
  });

  describe("Error Handling and Validation", () => {
    it("should handle invalid parameter combinations gracefully", () => {
      const invalidCombination: ParameterCombination = {
        growthRate: 99 as any, // Invalid growth rate
        riskLevel: "invalid" as any, // Invalid risk level
        charityPercentage: 99 as any, // Invalid charity percentage
      };

      expect(validateParameterCombination(invalidCombination)).toBe(false);

      // Should not create simulation config with invalid parameters
      expect(() => {
        createSimulationConfig(invalidCombination);
      }).toThrow();
    });

    it("should handle simulation configuration validation", async () => {
      const testCombination: ParameterCombination = {
        growthRate: 60,
        riskLevel: "high",
        charityPercentage: 30,
      };

      // Test that invalid timeout values are rejected
      expect(() => {
        createSimulationConfig({
          ...testCombination,
          // This helper doesn't exist yet, so let's inline the config
        });

        const invalidConfig: SimulationConfig = {
          ...defaultSimulationConfig,
          maxSimulationTimeMs: 500, // Below 1 second minimum
        };

        new GameEngineSimulator(invalidConfig);
      }).toThrow("Maximum simulation time must be at least 1 second");

      // Test that valid long-running configuration can be created
      const validLongConfig: SimulationConfig = {
        ...defaultSimulationConfig,
        durationDays: 365,
        initialPlayerCount: 2000,
        charityPercentage: testCombination.charityPercentage / 100,
        playerStrategies: mapRiskLevelToStrategy(testCombination.riskLevel),
        maxSimulationTimeMs: 2000, // 2 seconds (minimum compliant)
      };

      // Should create successfully
      expect(() => new GameEngineSimulator(validLongConfig)).not.toThrow();
    });
  });
});

// Helper Functions

/**
 * Map orchestrator risk level to cash-out strategy distribution
 */
function mapRiskLevelToStrategy(
  riskLevel: "low" | "mid" | "high"
): Record<CashOutStrategy, number> {
  switch (riskLevel) {
    case "low":
      return {
        low: 0.7, // 70% conservative
        average: 0.25, // 25% balanced
        high: 0.05, // 5% aggressive
      };
    case "mid":
      return {
        low: 0.3, // 30% conservative
        average: 0.5, // 50% balanced
        high: 0.2, // 20% aggressive
      };
    case "high":
      return {
        low: 0.1, // 10% conservative
        average: 0.3, // 30% balanced
        high: 0.6, // 60% aggressive
      };
    default:
      throw new Error(`Invalid risk level: ${riskLevel}`);
  }
}

/**
 * Create a simulation configuration from orchestrator parameters
 */
function createSimulationConfig(
  combination: ParameterCombination
): SimulationConfig {
  // Validate combination first
  if (!validateParameterCombination(combination)) {
    throw new Error(
      `Invalid parameter combination: ${JSON.stringify(combination)}`
    );
  }

  const basePlayerCount = 50; // Smaller for integration tests
  const adjustedPlayerCount = Math.round(
    basePlayerCount * (combination.growthRate / 35)
  );

  return {
    durationDays: 5, // Short for integration tests
    initialPlayerCount: Math.max(adjustedPlayerCount, 10), // Minimum 10 players
    dailySeed: `orchestrator-${combination.growthRate}-${combination.riskLevel}-${combination.charityPercentage}`,
    charityPercentage: combination.charityPercentage / 100, // Convert to decimal
    playerStrategies: mapRiskLevelToStrategy(combination.riskLevel),
    initialDonationAmount: 25,
    maxSimulationTimeMs: 15000, // 15 seconds max for integration tests
    enableProgressReporting: false,
  };
}
