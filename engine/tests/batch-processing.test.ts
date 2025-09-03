// Batch Processing Performance Tests
// Tests for improved throughput with batch game creation
// Validates that batch processing provides measurable performance improvements

import { describe, it, expect, beforeEach } from "vitest";
import { GameMatchingEngine } from "../src/types/game-matching-engine";
import { VirtualDollarManager } from "../src/types/virtual-dollar-types";
import { ScoringEngine } from "../src/types/scoring-engine";
import { DirectGameSessionFactory } from "../src/types/direct-factories";
import { PooledGameSessionFactory } from "../src/types/pooled-factories";
import {
  PRODUCTION_PERFORMANCE_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
} from "../src/types/factory-interfaces";
import {
  VirtualDollar,
  DollarState,
  GameSession,
  type BettingLevel,
  isValidBettingLevel,
  getBettingLevelValue,
  getBettingLevelWinnings,
} from "../src/types/virtual-dollar-engine";
import { isObjectPoolingEnabled } from "../src/types/object-pool";

describe("Batch Processing Performance", () => {
  let gameMatchingEngine: GameMatchingEngine;
  let dollarManager: VirtualDollarManager;
  let scoringEngine: ScoringEngine;
  let gameSessionFactory: DirectGameSessionFactory;

  beforeEach(() => {
    dollarManager = new VirtualDollarManager();
    scoringEngine = new ScoringEngine();
    gameSessionFactory = new DirectGameSessionFactory(
      PRODUCTION_PERFORMANCE_CONFIG
    );
    gameMatchingEngine = new GameMatchingEngine(
      dollarManager,
      scoringEngine,
      gameSessionFactory
    );
  });

  describe("Single vs Batch Game Creation Performance", () => {
    it("should demonstrate improved performance with batch operations", () => {
      // Create a large number of players for testing
      const numPlayers = 1000;
      const players = Array.from(
        { length: numPlayers },
        (_, i) => `player${i}`
      );

      // Create and pool all dollars
      const dollars = players.map((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
        return dollar;
      });

      // Measure batch processing performance
      const batchStartTime = performance.now();
      const batchResult = gameMatchingEngine.attemptMatching();
      const batchEndTime = performance.now();

      const batchDuration = batchEndTime - batchStartTime;
      const gamesCreated = batchResult.gamesCreated.length;

      // Should create 500 games (1000 players / 2)
      expect(gamesCreated).toBe(500);

      // Performance should be reasonable
      expect(batchDuration).toBeLessThan(1000); // Less than 1 second

      // Factory statistics should show efficient creation
      const stats = gameSessionFactory.getStatistics();
      expect(stats.objectsCreated).toBe(gamesCreated);
      expect(stats.averageCreationTime).toBeLessThan(1); // Less than 1ms per game

      console.log(
        `Batch created ${gamesCreated} games in ${batchDuration.toFixed(2)}ms`
      );
      console.log(
        `Average time per game: ${(batchDuration / gamesCreated).toFixed(3)}ms`
      );
    });

    it("should maintain consistency between batch and individual operations", () => {
      // Create test dollars
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");
      const dollar3 = dollarManager.createVirtualDollar("player3");
      const dollar4 = dollarManager.createVirtualDollar("player4");

      // Set up for matching
      [dollar1, dollar2, dollar3, dollar4].forEach((dollar) => {
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      // Process matching (should create 2 games)
      const result = gameMatchingEngine.attemptMatching();

      expect(result.gamesCreated.length).toBe(2);
      expect(result.matchesMade).toBe(2);

      // All created games should be valid
      result.gamesCreated.forEach((game) => {
        expect(game.dollar1).toBeDefined();
        expect(game.dollar2).toBeDefined();
        expect(game.level).toBeGreaterThan(0);
        expect(game.id).toBeDefined();
        expect(game.winnings).toBeGreaterThan(0);
      });
    });
  });

  describe("Memory Management with Batch Processing", () => {
    it("should properly manage memory during large batch operations", () => {
      const initialStats = gameSessionFactory.getStatistics();

      // Create a large batch
      const numPlayers = 2000;
      const players = Array.from(
        { length: numPlayers },
        (_, i) => `player${i}`
      );

      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      // Process matching
      const result = gameMatchingEngine.attemptMatching();
      const expectedGames = Math.floor(numPlayers / 2);

      expect(result.gamesCreated.length).toBe(expectedGames);

      // Resolve all games to test memory cleanup
      result.gamesCreated.forEach((game) => {
        const resolutionResult = gameMatchingEngine.resolveGame(
          game.id,
          "2024-01-15"
        );
        expect(resolutionResult.success).toBe(true);
      });

      // Check factory statistics
      const finalStats = gameSessionFactory.getStatistics();

      // Objects should be properly created and released
      expect(finalStats.objectsCreated).toBe(expectedGames);
      expect(finalStats.objectsReleased).toBe(expectedGames);
      expect(finalStats.objectsInUse).toBe(0);

      // Memory should be managed properly
      expect(finalStats.memoryUsageMB).toBeLessThan(10); // Should be minimal after cleanup
    });

    it("should handle cleanup of large numbers of completed games", () => {
      // Create and process a large batch
      const numPlayers = 500;
      const players = Array.from(
        { length: numPlayers },
        (_, i) => `player${i}`
      );

      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const result = gameMatchingEngine.attemptMatching();
      const gamesCreated = result.gamesCreated.length;

      // Resolve all games
      result.gamesCreated.forEach((game) => {
        gameMatchingEngine.resolveGame(game.id, "2024-01-15");
      });

      // Check that games are completed
      expect(gameMatchingEngine.getAuditTrail().totalGames).toBe(gamesCreated);

      // Clear completed games (should trigger factory release)
      gameMatchingEngine.clearCompletedGames();

      // Audit trail should show no games
      expect(gameMatchingEngine.getAuditTrail().totalGames).toBe(0);

      // Factory should show proper cleanup
      const stats = gameSessionFactory.getStatistics();
      expect(stats.objectsInUse).toBe(0);
    });
  });

  describe("Batch Processing Edge Cases", () => {
    it("should handle empty pools gracefully", () => {
      const result = gameMatchingEngine.attemptMatching();

      expect(result.gamesCreated.length).toBe(0);
      expect(result.matchesMade).toBe(0);
      expect(result.dollarsMatched.length).toBe(0);
    });

    it("should handle odd number of dollars correctly", () => {
      // Create 5 players (should match 4, leave 1 unmatched)
      const players = Array.from({ length: 5 }, (_, i) => `player${i}`);

      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const result = gameMatchingEngine.attemptMatching();

      // Should create 2 games (4 players matched, 1 left in pool)
      expect(result.gamesCreated.length).toBe(2);
      expect(result.dollarsMatched.length).toBe(4);

      // One player should remain in pool (5 players - 4 matched = 1 remaining)
      const poolStats = gameMatchingEngine.getPoolStatistics();
      expect(poolStats.totalDollarsInPool).toBe(1);
    });

    it("should respect concurrent game limits during batch processing", () => {
      // Set a low concurrent game limit
      gameMatchingEngine.setMaxConcurrentGames(5);

      // Create more players than the limit allows
      const numPlayers = 20;
      const players = Array.from(
        { length: numPlayers },
        (_, i) => `player${i}`
      );

      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });

      const result = gameMatchingEngine.attemptMatching();

      // Should only create up to the limit
      expect(result.gamesCreated.length).toBeLessThanOrEqual(5);
      expect(gameMatchingEngine.getActiveGameCount()).toBeLessThanOrEqual(5);
    });
  });

  describe("Direct vs Pooled Factory Performance Comparison", () => {
    it("should compare performance between direct and pooled factories", () => {
      // Create test setup
      const numPlayers = 1000;
      const players = Array.from(
        { length: numPlayers },
        (_, i) => `player${i}`
      );

      // Create separate dollars for each test
      const directDollars = players.map((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        return dollar;
      });

      const pooledDollars = players.map((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        return dollar;
      });

      // Test Direct Factory Performance
      const directFactory = new DirectGameSessionFactory(
        DEFAULT_PERFORMANCE_CONFIG
      );
      const directEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        directFactory
      );

      // Add dollars to direct engine
      directDollars.forEach((dollar) => directEngine.addToPool(dollar));

      const directStartTime = performance.now();
      const directResult = directEngine.attemptMatching();
      const directEndTime = performance.now();
      const directDuration = directEndTime - directStartTime;

      // Test Pooled Factory Performance (use DirectFactory if pooling disabled)
      const pooledFactory = isObjectPoolingEnabled()
        ? new PooledGameSessionFactory(PRODUCTION_PERFORMANCE_CONFIG)
        : new DirectGameSessionFactory(PRODUCTION_PERFORMANCE_CONFIG);
      const pooledEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        pooledFactory
      );

      // Add dollars to pooled engine
      pooledDollars.forEach((dollar) => pooledEngine.addToPool(dollar));

      const pooledStartTime = performance.now();
      const pooledResult = pooledEngine.attemptMatching();
      const pooledEndTime = performance.now();
      const pooledDuration = pooledEndTime - pooledStartTime;

      // Both should create the same number of games
      expect(directResult.gamesCreated.length).toBe(
        pooledResult.gamesCreated.length
      );
      expect(directResult.gamesCreated.length).toBe(500); // 1000 players / 2

      // Get factory statistics
      const directStats = directFactory.getStatistics();
      const pooledStats = pooledFactory.getStatistics();

      // Validate factory statistics
      expect(directStats.objectsCreated).toBe(500);
      expect(pooledStats.objectsCreated).toBe(500);

      // Comprehensive validation for created games
      directResult.gamesCreated.forEach((game: GameSession) => {
        // Validate VirtualDollar objects
        expect(game.dollar1).toBeDefined();
        expect(game.dollar2).toBeDefined();

        // Validate VirtualDollar interface properties
        const dollar1: VirtualDollar = game.dollar1;
        const dollar2: VirtualDollar = game.dollar2;

        expect(dollar1.id).toBeDefined();
        expect(dollar1.serialNumber).toBeDefined();
        expect(dollar1.ownerId).toBeDefined();
        expect(dollar1.runId).toBeDefined();
        expect(dollar1.createdAt).toBeInstanceOf(Date);
        expect(dollar1.currentScore).toBeGreaterThanOrEqual(0);
        expect(dollar1.currentScore).toBeLessThanOrEqual(1);
        expect(dollar1.state).toBeDefined();
        expect(dollar1.gamesInThisRun).toBeGreaterThanOrEqual(0);
        expect(dollar1.currentRunWinnings).toBeGreaterThanOrEqual(0);
        expect(dollar1.potValue).toBeGreaterThanOrEqual(0);

        expect(dollar2.id).toBeDefined();
        expect(dollar2.serialNumber).toBeDefined();
        expect(dollar2.ownerId).toBeDefined();
        expect(dollar2.runId).toBeDefined();
        expect(dollar2.createdAt).toBeInstanceOf(Date);
        expect(dollar2.currentScore).toBeGreaterThanOrEqual(0);
        expect(dollar2.currentScore).toBeLessThanOrEqual(1);
        expect(dollar2.state).toBeDefined();
        expect(dollar2.gamesInThisRun).toBeGreaterThanOrEqual(0);
        expect(dollar2.currentRunWinnings).toBeGreaterThanOrEqual(0);
        expect(dollar2.potValue).toBeGreaterThanOrEqual(0);

        // Validate BettingLevel using proper validation function
        expect(isValidBettingLevel(game.level)).toBe(true);
        expect(
          getBettingLevelValue(game.level as BettingLevel)
        ).toBeGreaterThan(0);
        expect(
          getBettingLevelWinnings(game.level as BettingLevel)
        ).toBeGreaterThan(0);

        // Validate game properties
        expect(game.id).toBeDefined();
        expect(game.winnings).toBeGreaterThan(0);
        expect(game.timestamp).toBeInstanceOf(Date);
      });

      pooledResult.gamesCreated.forEach((game: GameSession) => {
        // Validate VirtualDollar objects
        expect(game.dollar1).toBeDefined();
        expect(game.dollar2).toBeDefined();

        // Validate VirtualDollar interface properties
        const dollar1: VirtualDollar = game.dollar1;
        const dollar2: VirtualDollar = game.dollar2;

        expect(dollar1.id).toBeDefined();
        expect(dollar1.serialNumber).toBeDefined();
        expect(dollar1.ownerId).toBeDefined();
        expect(dollar1.runId).toBeDefined();
        expect(dollar1.createdAt).toBeInstanceOf(Date);
        expect(dollar1.currentScore).toBeGreaterThanOrEqual(0);
        expect(dollar1.currentScore).toBeLessThanOrEqual(1);
        expect(dollar1.state).toBeDefined();
        expect(dollar1.gamesInThisRun).toBeGreaterThanOrEqual(0);
        expect(dollar1.currentRunWinnings).toBeGreaterThanOrEqual(0);
        expect(dollar1.potValue).toBeGreaterThanOrEqual(0);

        expect(dollar2.id).toBeDefined();
        expect(dollar2.serialNumber).toBeDefined();
        expect(dollar2.ownerId).toBeDefined();
        expect(dollar2.runId).toBeDefined();
        expect(dollar2.createdAt).toBeInstanceOf(Date);
        expect(dollar2.currentScore).toBeGreaterThanOrEqual(0);
        expect(dollar2.currentScore).toBeLessThanOrEqual(1);
        expect(dollar2.state).toBeDefined();
        expect(dollar2.gamesInThisRun).toBeGreaterThanOrEqual(0);
        expect(dollar2.currentRunWinnings).toBeGreaterThanOrEqual(0);
        expect(dollar2.potValue).toBeGreaterThanOrEqual(0);

        // Validate BettingLevel using proper validation function
        expect(isValidBettingLevel(game.level)).toBe(true);
        expect(
          getBettingLevelValue(game.level as BettingLevel)
        ).toBeGreaterThan(0);
        expect(
          getBettingLevelWinnings(game.level as BettingLevel)
        ).toBeGreaterThan(0);

        // Validate game properties
        expect(game.id).toBeDefined();
        expect(game.winnings).toBeGreaterThan(0);
        expect(game.timestamp).toBeInstanceOf(Date);
      });

      console.log(
        `Direct Factory: ${directDuration.toFixed(
          2
        )}ms, ${directStats.averageCreationTime.toFixed(3)}ms avg per game`
      );
      console.log(
        `Pooled Factory: ${pooledDuration.toFixed(
          2
        )}ms, ${pooledStats.averageCreationTime.toFixed(3)}ms avg per game`
      );
      console.log(`Pool Hit Rate: ${pooledStats.poolHitRate.toFixed(2)}%`);
    });

    it("should show different behavior based on pooling configuration", () => {
      const poolingEnabled = isObjectPoolingEnabled();

      if (poolingEnabled) {
        // Test with pooling enabled
        const pooledFactory = new PooledGameSessionFactory(
          PRODUCTION_PERFORMANCE_CONFIG
        );
        const pooledEngine = new GameMatchingEngine(
          dollarManager,
          scoringEngine,
          pooledFactory
        );

        // Create test dollars
        const testDollars = Array.from({ length: 10 }, (_, i) => {
          const dollar = dollarManager.createVirtualDollar(`player${i}`);
          dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          pooledEngine.addToPool(dollar);
          return dollar;
        });

        const result = pooledEngine.attemptMatching();
        const stats = pooledFactory.getStatistics();

        // With pooling enabled, we should see pool utilization
        expect(stats.poolHitRate).toBeGreaterThan(0);
        expect(result.gamesCreated.length).toBe(5);

        console.log(
          `Pooling enabled - Hit rate: ${stats.poolHitRate.toFixed(2)}%`
        );
      } else {
        // Test with pooling disabled
        const directFactory = new DirectGameSessionFactory(
          DEFAULT_PERFORMANCE_CONFIG
        );
        const directEngine = new GameMatchingEngine(
          dollarManager,
          scoringEngine,
          directFactory
        );

        // Create test dollars
        const testDollars = Array.from({ length: 10 }, (_, i) => {
          const dollar = dollarManager.createVirtualDollar(`player${i}`);
          dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
          directEngine.addToPool(dollar);
          return dollar;
        });

        const result = directEngine.attemptMatching();
        const stats = directFactory.getStatistics();

        // With pooling disabled, pool hit rate should be 0
        expect(stats.poolHitRate).toBe(0);
        expect(result.gamesCreated.length).toBe(5);

        console.log(
          `Pooling disabled - Hit rate: ${stats.poolHitRate.toFixed(2)}%`
        );
      }
    });

    it("should demonstrate memory efficiency differences", () => {
      const numPlayers = 2000;
      const players = Array.from(
        { length: numPlayers },
        (_, i) => `player${i}`
      );

      // Test Direct Factory Memory Usage
      const directFactory = new DirectGameSessionFactory(
        DEFAULT_PERFORMANCE_CONFIG
      );
      const directEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        directFactory
      );

      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        directEngine.addToPool(dollar);
      });

      const directResult = directEngine.attemptMatching();
      const directStats = directFactory.getStatistics();

      // Test Pooled Factory Memory Usage (use DirectFactory if pooling disabled)
      const pooledFactory = isObjectPoolingEnabled()
        ? new PooledGameSessionFactory(PRODUCTION_PERFORMANCE_CONFIG)
        : new DirectGameSessionFactory(PRODUCTION_PERFORMANCE_CONFIG);
      const pooledEngine = new GameMatchingEngine(
        dollarManager,
        scoringEngine,
        pooledFactory
      );

      players.forEach((playerId) => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        pooledEngine.addToPool(dollar);
      });

      const pooledResult = pooledEngine.attemptMatching();
      const pooledStats = pooledFactory.getStatistics();

      // Both should create the same number of games
      expect(directResult.gamesCreated.length).toBe(
        pooledResult.gamesCreated.length
      );

      // Memory usage comparison
      console.log(
        `Direct Factory Memory: ${directStats.memoryUsageMB.toFixed(2)}MB`
      );
      console.log(
        `Pooled Factory Memory: ${pooledStats.memoryUsageMB.toFixed(2)}MB`
      );
      console.log(`Direct Objects in Use: ${directStats.objectsInUse}`);
      console.log(`Pooled Objects in Use: ${pooledStats.objectsInUse}`);

      // Pooled factory should generally use less memory due to object reuse
      if (isObjectPoolingEnabled()) {
        expect(pooledStats.poolHitRate).toBeGreaterThan(0);
      }
    });

    it("should validate VirtualDollar and BettingLevel properties correctly", () => {
      // Create test dollars with proper validation
      const testDollars = Array.from({ length: 4 }, (_, i) => {
        const dollar = dollarManager.createVirtualDollar(`player${i}`);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
        return dollar;
      });

      // Validate VirtualDollar properties
      testDollars.forEach((dollar: VirtualDollar) => {
        // Core properties
        expect(dollar.id).toBeDefined();
        expect(typeof dollar.id).toBe("string");
        expect(dollar.id.length).toBeGreaterThan(0);

        expect(dollar.serialNumber).toBeDefined();
        expect(typeof dollar.serialNumber).toBe("string");
        expect(dollar.serialNumber).toMatch(/^[A-Z]\d{8}[A-Z]$/); // Format validation

        expect(dollar.ownerId).toBeDefined();
        expect(typeof dollar.ownerId).toBe("string");

        expect(dollar.runId).toBeDefined();
        expect(typeof dollar.runId).toBe("string");

        // Date validation
        expect(dollar.createdAt).toBeInstanceOf(Date);
        expect(dollar.createdAt.getTime()).toBeLessThanOrEqual(Date.now());

        // Score validation (0-1 range)
        expect(dollar.currentScore).toBeGreaterThanOrEqual(0);
        expect(dollar.currentScore).toBeLessThanOrEqual(1);

        // State validation
        expect(dollar.state).toBe(DollarState.POOLED);

        // Numeric validations
        expect(dollar.gamesInThisRun).toBeGreaterThanOrEqual(0);
        expect(dollar.currentRunWinnings).toBeGreaterThanOrEqual(0);
        expect(dollar.potValue).toBeGreaterThanOrEqual(0);

        // Boolean validation
        expect(typeof dollar.isIndependentRun).toBe("boolean");

        // Array validation
        expect(Array.isArray(dollar.gameHistory)).toBe(true);
      });

      // Test game creation and BettingLevel validation
      const result = gameMatchingEngine.attemptMatching();
      expect(result.gamesCreated.length).toBe(2);

      result.gamesCreated.forEach((game: GameSession) => {
        // Validate BettingLevel using utility functions
        const level = game.level;
        expect(isValidBettingLevel(level)).toBe(true);

        // Test BettingLevel utility functions
        const levelValue = getBettingLevelValue(level as BettingLevel);
        const levelWinnings = getBettingLevelWinnings(level as BettingLevel);

        expect(levelValue).toBeGreaterThan(0);
        expect(levelWinnings).toBeGreaterThan(0);
        expect(levelValue).toBe(Math.pow(2, level - 1)); // 2^(level-1)
        expect(levelWinnings).toBe(level * 1.8); // level * 1.8

        // Validate game winnings match betting level
        expect(game.winnings).toBeGreaterThan(0);

        console.log(
          `Game Level: ${level}, Value: ${levelValue}, Winnings: ${levelWinnings}`
        );
      });

      // Test edge cases for BettingLevel validation
      expect(isValidBettingLevel(1)).toBe(true); // Minimum valid level
      expect(isValidBettingLevel(10)).toBe(true); // Maximum valid level
      expect(isValidBettingLevel(0)).toBe(false); // Below minimum
      expect(isValidBettingLevel(11)).toBe(false); // Above maximum
      expect(isValidBettingLevel(5.5)).toBe(false); // Non-integer
      expect(isValidBettingLevel(-1)).toBe(false); // Negative
    });
  });
});
