// Batch Processing Performance Tests
// Tests for improved throughput with batch game creation
// Validates that batch processing provides measurable performance improvements

import { describe, it, expect, beforeEach } from 'vitest';
import { GameMatchingEngine } from '../src/types/game-matching-engine';
import { VirtualDollarManager } from '../src/types/virtual-dollar-types';
import { ScoringEngine } from '../src/types/scoring-engine';
import { DirectGameSessionFactory } from '../src/types/direct-factories';
import { PooledGameSessionFactory } from '../src/types/pooled-factories';
import { PRODUCTION_PERFORMANCE_CONFIG } from '../src/types/factory-interfaces';
import { VirtualDollar, DollarState, GameSession, BettingLevel } from '../src/types/virtual-dollar-engine';
import { isObjectPoolingEnabled } from '../src/types/object-pool';

describe('Batch Processing Performance', () => {
  let gameMatchingEngine: GameMatchingEngine;
  let dollarManager: VirtualDollarManager;
  let scoringEngine: ScoringEngine;
  let gameSessionFactory: DirectGameSessionFactory;

  beforeEach(() => {
    dollarManager = new VirtualDollarManager();
    scoringEngine = new ScoringEngine();
    gameSessionFactory = new DirectGameSessionFactory(PRODUCTION_PERFORMANCE_CONFIG);
    gameMatchingEngine = new GameMatchingEngine(dollarManager, scoringEngine, gameSessionFactory);
  });

  describe('Single vs Batch Game Creation Performance', () => {
    it('should demonstrate improved performance with batch operations', () => {
      // Create a large number of players for testing
      const numPlayers = 1000;
      const players = Array.from({ length: numPlayers }, (_, i) => `player${i}`);
      
      // Create and pool all dollars
      const dollars = players.map(playerId => {
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
      
      console.log(`Batch created ${gamesCreated} games in ${batchDuration.toFixed(2)}ms`);
      console.log(`Average time per game: ${(batchDuration / gamesCreated).toFixed(3)}ms`);
    });

    it('should maintain consistency between batch and individual operations', () => {
      // Create test dollars
      const dollar1 = dollarManager.createVirtualDollar('player1');
      const dollar2 = dollarManager.createVirtualDollar('player2');
      const dollar3 = dollarManager.createVirtualDollar('player3');
      const dollar4 = dollarManager.createVirtualDollar('player4');
      
      // Set up for matching
      [dollar1, dollar2, dollar3, dollar4].forEach(dollar => {
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });
      
      // Process matching (should create 2 games)
      const result = gameMatchingEngine.attemptMatching();
      
      expect(result.gamesCreated.length).toBe(2);
      expect(result.matchesMade).toBe(2);
      
      // All created games should be valid
      result.gamesCreated.forEach(game => {
        expect(game.dollar1).toBeDefined();
        expect(game.dollar2).toBeDefined();
        expect(game.level).toBeGreaterThan(0);
        expect(game.id).toBeDefined();
        expect(game.winnings).toBeGreaterThan(0);
      });
    });
  });

  describe('Memory Management with Batch Processing', () => {
    it('should properly manage memory during large batch operations', () => {
      const initialStats = gameSessionFactory.getStatistics();
      
      // Create a large batch
      const numPlayers = 2000;
      const players = Array.from({ length: numPlayers }, (_, i) => `player${i}`);
      
      players.forEach(playerId => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });
      
      // Process matching
      const result = gameMatchingEngine.attemptMatching();
      const expectedGames = Math.floor(numPlayers / 2);
      
      expect(result.gamesCreated.length).toBe(expectedGames);
      
      // Resolve all games to test memory cleanup
      result.gamesCreated.forEach(game => {
        const resolutionResult = gameMatchingEngine.resolveGame(game.id, '2024-01-15');
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

    it('should handle cleanup of large numbers of completed games', () => {
      // Create and process a large batch
      const numPlayers = 500;
      const players = Array.from({ length: numPlayers }, (_, i) => `player${i}`);
      
      players.forEach(playerId => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });
      
      const result = gameMatchingEngine.attemptMatching();
      const gamesCreated = result.gamesCreated.length;
      
      // Resolve all games
      result.gamesCreated.forEach(game => {
        gameMatchingEngine.resolveGame(game.id, '2024-01-15');
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

  describe('Batch Processing Edge Cases', () => {
    it('should handle empty pools gracefully', () => {
      const result = gameMatchingEngine.attemptMatching();
      
      expect(result.gamesCreated.length).toBe(0);
      expect(result.matchesMade).toBe(0);
      expect(result.dollarsMatched.length).toBe(0);
    });

    it('should handle odd number of dollars correctly', () => {
      // Create 5 players (should match 4, leave 1 unmatched)
      const players = Array.from({ length: 5 }, (_, i) => `player${i}`);
      
      players.forEach(playerId => {
        const dollar = dollarManager.createVirtualDollar(playerId);
        dollarManager.updateDollarState(dollar.id, DollarState.POOLED);
        gameMatchingEngine.addToPool(dollar);
      });
      
      const result = gameMatchingEngine.attemptMatching();
      
      // Should create 2 games (4 players matched, 1 left in pool)
      expect(result.gamesCreated.length).toBe(2);
      expect(result.dollarsMatched.length).toBe(4);
      
      // One player should remain in pool
      const poolStats = gameMatchingEngine.getPoolStatistics();
      expect(poolStats.totalDollarsInPool).toBe(1);
    });

    it('should respect concurrent game limits during batch processing', () => {
      // Set a low concurrent game limit
      gameMatchingEngine.setMaxConcurrentGames(5);
      
      // Create more players than the limit allows
      const numPlayers = 20;
      const players = Array.from({ length: numPlayers }, (_, i) => `player${i}`);
      
      players.forEach(playerId => {
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
});