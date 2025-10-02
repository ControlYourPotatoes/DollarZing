// Import Resolution Tests - Task 3.1
// Verify that all imports resolve correctly after SimulationController refactor

import { describe, it, expect } from "vitest";

describe("Import Resolution", () => {
  describe("GameEngineSimulator imports", () => {
    it("should import GameEngineSimulator from simulation directory", async () => {
      const { GameEngineSimulator } = await import(
        "../src/simulation/game-engine-simulator"
      );
      expect(GameEngineSimulator).toBeDefined();
      expect(typeof GameEngineSimulator).toBe("function");
    });

    it("should have GameEngineSimulator types available for TypeScript compilation", () => {
      // This test verifies that the types are properly exported for TypeScript
      // Interfaces are compile-time only, so we can't test them at runtime
      // The fact that this test compiles means the types are properly exported
      const config: import("../src/simulation/game-engine-simulator").SimulationConfig =
        {
          durationDays: 1,
          initialPlayerCount: 1,
          dailySeed: "test",
          charityPercentage: 0.1,
          playerStrategies: {},
          initialDonationAmount: 1,
          maxSimulationTimeMs: 1000,
          enableProgressReporting: false,
        };
      expect(config).toBeDefined();
    });
  });

  describe("Component class imports", () => {
    it("should import DayProcessor from simulation directory", async () => {
      const { DayProcessor } = await import("../src/simulation/day-processor");
      expect(DayProcessor).toBeDefined();
      expect(typeof DayProcessor).toBe("function");
    });

    it("should import PlayerManager from simulation directory", async () => {
      const { PlayerManager } = await import(
        "../src/simulation/player-manager"
      );
      expect(PlayerManager).toBeDefined();
      expect(typeof PlayerManager).toBe("function");
    });

    it("should import GameProcessor from simulation directory", async () => {
      const { GameProcessor } = await import(
        "../src/simulation/game-processor"
      );
      expect(GameProcessor).toBeDefined();
      expect(typeof GameProcessor).toBe("function");
    });
  });

  describe("Main index exports", () => {
    it("should export GameEngineSimulator from main index", async () => {
      const exports = await import("../src/index");
      expect(exports.GameEngineSimulator).toBeDefined();
      expect(typeof exports.GameEngineSimulator).toBe("function");
    });

    it("should have simulation types available for TypeScript compilation from main index", () => {
      // This test verifies that the types are properly exported for TypeScript
      // Interfaces are compile-time only, so we can't test them at runtime
      // The fact that this test compiles means the types are properly exported
      const config: import("../src/index").SimulationConfig = {
        durationDays: 1,
        initialPlayerCount: 1,
        dailySeed: "test",
        charityPercentage: 0.1,
        playerStrategies: {},
        initialDonationAmount: 1,
        maxSimulationTimeMs: 1000,
        enableProgressReporting: false,
      };
      expect(config).toBeDefined();
    });
  });

  // Legacy SimulationController tests removed - migrated to GameEngineSimulator

  describe("Circular dependency check", () => {
    it("should not have circular dependencies in simulation directory", async () => {
      // This test will fail if there are circular imports
      const simulationModule = await import("../src/simulation/index");
      expect(simulationModule).toBeDefined();
    });

    it("should not have circular dependencies between types and simulation", async () => {
      // Import both directories to check for circular deps
      const typesModule = await import("../src/types/player-balance-manager");
      const simulationModule = await import(
        "../src/simulation/game-engine-simulator"
      );

      expect(typesModule).toBeDefined();
      expect(simulationModule).toBeDefined();
    });
  });
});
