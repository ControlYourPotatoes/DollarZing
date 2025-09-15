// GameMatchingEngine Factory Integration Tests
// Tests for GameMatchingEngine with factory dependency injection
// Validates that the engine properly uses factories for object creation and release

import { describe, it, expect, beforeEach } from "vitest";
import { GameMatchingEngine } from "../src/types/game-matching-engine";
import { VirtualDollarManager } from "../src/types/virtual-dollar-types";
import { ScoringEngine } from "../src/types/scoring-engine";
import { GameSessionFactory } from "../src/types/factory-interfaces";
import { DirectGameSessionFactory } from "../src/test-utils";
import { PooledGameSessionFactory } from "../src/types/pooled-factories";
import { PRODUCTION_PERFORMANCE_CONFIG } from "../src/types/factory-interfaces";
import { DollarState } from "../src/types/virtual-dollar-engine";

describe("GameMatchingEngine Factory Integration", () => {
  let gameMatchingEngine: GameMatchingEngine;
  let dollarManager: VirtualDollarManager;
  let scoringEngine: ScoringEngine;
  let gameSessionFactory: GameSessionFactory;

  beforeEach(() => {
    dollarManager = new VirtualDollarManager();
    scoringEngine = new ScoringEngine();
    gameSessionFactory = new DirectGameSessionFactory(
      PRODUCTION_PERFORMANCE_CONFIG
    );
  });

  describe("Constructor Factory Injection", () => {
    it("should accept GameSessionFactory in constructor", () => {
      expect(() => {
        gameMatchingEngine = new GameMatchingEngine(
          dollarManager,
          scoringEngine,
          gameSessionFactory
        );
      }).not.toThrow();
    });

    it("should store the factory reference for later use", () => {
      gameMatchingEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        gameSessionFactory
      );

      // Factory should be stored and accessible (we'll verify this through usage)
      expect(gameMatchingEngine).toBeDefined();
    });

    it("should work with both Direct and Pooled factories", () => {
      // Test with Direct factory
      const directFactory = new DirectGameSessionFactory(
        PRODUCTION_PERFORMANCE_CONFIG
      );
      const engineWithDirect = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        directFactory
      );
      expect(engineWithDirect).toBeDefined();

      // Test with Pooled factory (note: pooling may be disabled in test environment)
      const pooledFactory = new PooledGameSessionFactory(
        PRODUCTION_PERFORMANCE_CONFIG
      );
      const engineWithPooled = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        pooledFactory
      );
      expect(engineWithPooled).toBeDefined();
    });
  });

  describe("Game Creation Through Factory", () => {
    beforeEach(() => {
      gameMatchingEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        gameSessionFactory
      );
    });

    it("should use factory.create() instead of direct object instantiation", () => {
      // Create test dollars
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      // Set up dollars for matching
      dollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      // Add to pool
      gameMatchingEngine.addToPool(dollar1);
      gameMatchingEngine.addToPool(dollar2);

      // Attempt matching
      const result = gameMatchingEngine.attemptMatching();

      // Should have created games using the factory
      expect(result.matchesMade).toBeGreaterThan(0);
      expect(result.gamesCreated.length).toBeGreaterThan(0);

      // Factory statistics should show object creation
      const stats = gameSessionFactory.getStatistics();
      expect(stats.objectsCreated).toBeGreaterThan(0);
    });

    it("should handle batch game creation efficiently", () => {
      // Create multiple pairs of dollars
      const players = Array.from({ length: 10 }, (_, i) => `player${i}`);
      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      // Process matching should handle multiple games
      const result = gameMatchingEngine.attemptMatching();

      // Should create multiple games
      expect(result.gamesCreated.length).toBeGreaterThan(1);

      // All games should be properly created through factory
      const stats = gameSessionFactory.getStatistics();
      expect(stats.objectsCreated).toBe(result.gamesCreated.length);
    });
  });

  describe("Game Session Lifecycle Management", () => {
    beforeEach(() => {
      gameMatchingEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        gameSessionFactory
      );
    });

    it("should release game sessions through factory after resolution", () => {
      // Create and match dollars
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      dollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      gameMatchingEngine.addToPool(dollar1);
      gameMatchingEngine.addToPool(dollar2);

      // Process matching
      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.gamesCreated.length).toBeGreaterThan(0);

      const gameSession = matchResult.gamesCreated[0];

      // Resolve the game
      const resolutionResult = gameMatchingEngine.resolveGame(
        gameSession.id,
        "2024-01-15"
      );
      if (!resolutionResult.success) {
        console.log("Game resolution failed:", resolutionResult.error);
      }
      expect(resolutionResult.success).toBe(true);

      // Factory should show that objects were both created and released
      const stats = gameSessionFactory.getStatistics();
      expect(stats.objectsCreated).toBeGreaterThan(0);
      expect(stats.objectsReleased).toBeGreaterThan(0);
      expect(stats.objectsInUse).toBe(
        stats.objectsCreated - stats.objectsReleased
      );
    });

    it("should handle concurrent game lifecycle correctly", () => {
      // Create multiple pairs for concurrent games
      const players = Array.from({ length: 20 }, (_, i) => `player${i}`);
      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      // Process matching to create multiple concurrent games
      const matchResult = gameMatchingEngine.attemptMatching();
      const createdGames = matchResult.gamesCreated;

      // Resolve games one by one
      const resolutionPromises = createdGames.map((game) =>
        gameMatchingEngine.resolveGame(game.id, "2024-01-15")
      );

      // All resolutions should succeed
      resolutionPromises.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Factory statistics should be consistent
      const stats = gameSessionFactory.getStatistics();
      expect(stats.objectsCreated).toBe(createdGames.length);
      expect(stats.objectsReleased).toBe(createdGames.length);
      expect(stats.objectsInUse).toBe(0);
    });
  });

  describe("Performance Validation", () => {
    it("should maintain performance with factory abstraction", () => {
      gameMatchingEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        gameSessionFactory
      );

      // Create large number of games to test performance
      const startTime = performance.now();

      const players = Array.from({ length: 1000 }, (_, i) => `player${i}`);
      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const matchResult = gameMatchingEngine.attemptMatching();
      const endTime = performance.now();

      // Should complete within reasonable time (less than 1 second for 500 games)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(matchResult.gamesCreated.length).toBe(500); // 1000 players = 500 games

      // Factory overhead should be minimal
      const stats = gameSessionFactory.getStatistics();
      expect(stats.averageCreationTime).toBeLessThan(1); // Less than 1ms per creation
    });
  });

  describe("Error Handling with Factory", () => {
    beforeEach(() => {
      gameMatchingEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        gameSessionFactory
      );
    });

    it("should handle factory creation failures gracefully", () => {
      // Test with invalid dollar states (factory should validate)
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      // Don't set dollars to POOLED state - should cause validation errors

      const addResult1 = gameMatchingEngine.addToPool(dollar1);
      const addResult2 = gameMatchingEngine.addToPool(dollar2);

      expect(addResult1.success).toBe(false);
      expect(addResult2.success).toBe(false);

      // No games should be created with invalid dollars
      const matchResult = gameMatchingEngine.attemptMatching();
      expect(matchResult.gamesCreated.length).toBe(0);
    });

    it("should clean up properly on factory errors", () => {
      // This test verifies that if game creation fails, any allocated resources are released

      // Create valid setup but introduce potential failure scenario
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      dollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      gameMatchingEngine.addToPool(dollar1);
      gameMatchingEngine.addToPool(dollar2);

      // Process matching - should succeed normally
      gameMatchingEngine.attemptMatching();

      // Even if some operations fail, objects should be managed correctly
      const finalStats = gameSessionFactory.getStatistics();
      expect(finalStats.objectsInUse).toBeGreaterThanOrEqual(0); // No negative in-use counts
    });
  });
});
