// DirectGameSessionFactory Tests
// Tests for non-pooled game session factory implementation
// Validates direct object creation without pooling for development/testing scenarios

import { DirectGameSessionFactory } from '../src/types/direct-factories';
import { GameSessionFactory, DEFAULT_PERFORMANCE_CONFIG, PerformanceConfig, GamePair } from '../src/types/factory-interfaces';
import { VirtualDollar, BettingLevel } from '../src/types/virtual-dollar-engine';

describe('DirectGameSessionFactory', () => {
  let factory: DirectGameSessionFactory;
  let config: PerformanceConfig;
  let testDollar1: VirtualDollar;
  let testDollar2: VirtualDollar;

  beforeEach(() => {
    config = {
      ...DEFAULT_PERFORMANCE_CONFIG,
      enableObjectPooling: false, // Direct factory should never use pooling
      enablePerformanceMetrics: true
    };
    factory = new DirectGameSessionFactory(config);

    // Create test virtual dollars
    testDollar1 = {
      id: 'test_dollar_1',
      serialNumber: 'A12345678B',
      playerId: 'player1',
      runId: 'test_run_1',
      created: new Date(),
      isActive: true,
      currentLevel: 1,
      gamesWon: 0,
      gamesLost: 0,
      totalWinnings: 0,
      cashOutStrategy: 'average',
      hasBeenPaired: false,
      lastGameTime: null,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      levelProgression: []
    };

    testDollar2 = {
      id: 'test_dollar_2',
      serialNumber: 'C87654321D',
      playerId: 'player2',
      runId: 'test_run_2',
      created: new Date(),
      isActive: true,
      currentLevel: 1,
      gamesWon: 0,
      gamesLost: 0,
      totalWinnings: 0,
      cashOutStrategy: 'high',
      hasBeenPaired: false,
      lastGameTime: null,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      levelProgression: []
    };
  });

  describe('Factory Interface Compliance', () => {
    it('should implement GameSessionFactory interface', () => {
      expect(factory).toBeDefined();
      expect(typeof factory.create).toBe('function');
      expect(typeof factory.release).toBe('function');
      expect(typeof factory.createBatch).toBe('function');
      expect(typeof factory.getStatistics).toBe('function');
    });

    it('should be instanceable through interface type', () => {
      const interfaceFactory: GameSessionFactory = new DirectGameSessionFactory(config);
      expect(interfaceFactory).toBeDefined();
      expect(interfaceFactory.create).toBeDefined();
    });
  });

  describe('Object Creation Behavior', () => {
    it('should create valid game session objects', () => {
      const level: BettingLevel = 3;
      const session = factory.create(testDollar1, testDollar2, level);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.dollar1).toBe(testDollar1);
      expect(session.dollar2).toBe(testDollar2);
      expect(session.level).toBe(level);
      expect(session.gameNumber).toBeGreaterThan(0);
      expect(session.winnings).toBe(level * 1.8); // level × 1.8
      expect(session.winner).toBeDefined(); // Winner is set to emptyDollar
      expect(session.loser).toBeDefined(); // Loser is set to emptyDollar
    });

    it('should create unique sessions on each call', () => {
      const level: BettingLevel = 2;
      const session1 = factory.create(testDollar1, testDollar2, level);
      const session2 = factory.create(testDollar1, testDollar2, level);

      expect(session1).not.toBe(session2);
      expect(session1.id).not.toBe(session2.id);
      expect(session1.gameNumber).not.toBe(session2.gameNumber);
    });

    it('should generate sequential game numbers', () => {
      const level: BettingLevel = 1;
      const session1 = factory.create(testDollar1, testDollar2, level);
      const session2 = factory.create(testDollar1, testDollar2, level);
      const session3 = factory.create(testDollar1, testDollar2, level);

      expect(session2.gameNumber).toBe(session1.gameNumber + 1);
      expect(session3.gameNumber).toBe(session2.gameNumber + 1);
    });

    it('should calculate winnings correctly for different levels', () => {
      const testCases: Array<{ level: BettingLevel; expectedWinnings: number }> = [
        { level: 1, expectedWinnings: 1.8 },  // 1 × 1.8
        { level: 2, expectedWinnings: 3.6 },  // 2 × 1.8
        { level: 3, expectedWinnings: 5.4 },  // 3 × 1.8
        { level: 4, expectedWinnings: 7.2 },  // 4 × 1.8
        { level: 10, expectedWinnings: 18.0 } // 10 × 1.8
      ];

      testCases.forEach(({ level, expectedWinnings }) => {
        const session = factory.create(testDollar1, testDollar2, level);
        expect(session.winnings).toBe(expectedWinnings);
      });
    });
  });

  describe('Parameter Validation', () => {
    it('should throw error for null/undefined dollar1', () => {
      const level: BettingLevel = 1;
      expect(() => factory.create(null as any, testDollar2, level))
        .toThrow('Invalid virtual dollar parameters: both dollars must be provided');
      expect(() => factory.create(undefined as any, testDollar2, level))
        .toThrow('Invalid virtual dollar parameters: both dollars must be provided');
    });

    it('should throw error for null/undefined dollar2', () => {
      const level: BettingLevel = 1;
      expect(() => factory.create(testDollar1, null as any, level))
        .toThrow('Invalid virtual dollar parameters: both dollars must be provided');
      expect(() => factory.create(testDollar1, undefined as any, level))
        .toThrow('Invalid virtual dollar parameters: both dollars must be provided');
    });

    it('should throw error for invalid betting levels', () => {
      expect(() => factory.create(testDollar1, testDollar2, 0 as BettingLevel))
        .toThrow('Invalid betting level: must be between 1 and 10');
      expect(() => factory.create(testDollar1, testDollar2, 11 as BettingLevel))
        .toThrow('Invalid betting level: must be between 1 and 10');
      expect(() => factory.create(testDollar1, testDollar2, -1 as BettingLevel))
        .toThrow('Invalid betting level: must be between 1 and 10');
    });

    it('should accept all valid betting levels', () => {
      for (let level = 1; level <= 10; level++) {
        expect(() => factory.create(testDollar1, testDollar2, level as BettingLevel))
          .not.toThrow();
      }
    });
  });

  describe('Non-Pooled Behavior', () => {
    it('should not use object pooling', () => {
      const level: BettingLevel = 1;
      const session1 = factory.create(testDollar1, testDollar2, level);
      const session2 = factory.create(testDollar1, testDollar2, level);

      // Direct factory should always create new objects
      expect(session1).not.toBe(session2);
    });

    it('should handle release gracefully without pooling', () => {
      const level: BettingLevel = 1;
      const session = factory.create(testDollar1, testDollar2, level);

      // Release should not throw error even though no pooling is used
      expect(() => factory.release(session)).not.toThrow();
      
      // Object should remain valid after release (no pooling means no reset)
      expect(session.id).toBeDefined();
      expect(session.dollar1).toBe(testDollar1);
      expect(session.dollar2).toBe(testDollar2);
    });

    it('should handle null/undefined release without error', () => {
      expect(() => factory.release(null as any)).not.toThrow();
      expect(() => factory.release(undefined as any)).not.toThrow();
    });
  });

  describe('Batch Operations', () => {
    it('should create batch of game sessions', () => {
      const pairs: GamePair[] = [
        { dollar1: testDollar1, dollar2: testDollar2, level: 1 },
        { dollar1: testDollar2, dollar2: testDollar1, level: 2 },
        { dollar1: testDollar1, dollar2: testDollar2, level: 3 }
      ];

      const sessions = factory.createBatch(pairs);

      expect(sessions).toHaveLength(3);
      expect(sessions[0].level).toBe(1);
      expect(sessions[1].level).toBe(2);
      expect(sessions[2].level).toBe(3);

      // All should be unique objects
      expect(sessions[0]).not.toBe(sessions[1]);
      expect(sessions[1]).not.toBe(sessions[2]);
    });

    it('should return empty array for empty input', () => {
      expect(factory.createBatch([])).toEqual([]);
      expect(factory.createBatch(null as any)).toEqual([]);
      expect(factory.createBatch(undefined as any)).toEqual([]);
    });

    it('should handle batch with invalid pairs gracefully', () => {
      const pairs: GamePair[] = [
        { dollar1: testDollar1, dollar2: testDollar2, level: 1 },
        { dollar1: null as any, dollar2: testDollar2, level: 2 }, // Invalid
        { dollar1: testDollar1, dollar2: testDollar2, level: 3 }
      ];

      const sessions = factory.createBatch(pairs);

      // Should create sessions for valid pairs and skip invalid ones
      expect(sessions).toHaveLength(2);
      expect(sessions[0].level).toBe(1);
      expect(sessions[1].level).toBe(3);
    });

    it('should continue processing after individual failures', () => {
      const pairs: GamePair[] = [
        { dollar1: testDollar1, dollar2: testDollar2, level: 1 },
        { dollar1: testDollar1, dollar2: null as any, level: 2 }, // Invalid
        { dollar1: testDollar1, dollar2: testDollar2, level: 3 },
        { dollar1: testDollar1, dollar2: testDollar2, level: 15 as BettingLevel }, // Invalid level
        { dollar1: testDollar1, dollar2: testDollar2, level: 4 }
      ];

      const sessions = factory.createBatch(pairs);

      // Should create sessions for valid pairs only
      expect(sessions).toHaveLength(3);
      expect(sessions[0].level).toBe(1);
      expect(sessions[1].level).toBe(3);
      expect(sessions[2].level).toBe(4);
    });
  });

  describe('Statistics Tracking', () => {
    it('should provide basic statistics', () => {
      const stats = factory.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.objectsCreated).toBe(0);
      expect(stats.objectsReleased).toBe(0);
      expect(stats.objectsInUse).toBe(0);
      expect(stats.poolSize).toBe(0); // Direct factory has no pool
      expect(stats.poolHitRate).toBe(0);
    });

    it('should track object creation count', () => {
      const level: BettingLevel = 1;
      factory.create(testDollar1, testDollar2, level);
      factory.create(testDollar1, testDollar2, level);

      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsInUse).toBe(2);
    });

    it('should track object release count', () => {
      const level: BettingLevel = 1;
      const session1 = factory.create(testDollar1, testDollar2, level);
      const session2 = factory.create(testDollar1, testDollar2, level);

      let stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(0);
      expect(stats.objectsInUse).toBe(2);

      factory.release(session1);
      stats = factory.getStatistics();
      expect(stats.objectsReleased).toBe(1);
      expect(stats.objectsInUse).toBe(1);

      factory.release(session2);
      stats = factory.getStatistics();
      expect(stats.objectsReleased).toBe(2);
      expect(stats.objectsInUse).toBe(0);
    });

    it('should track batch creation in statistics', () => {
      const pairs: GamePair[] = [
        { dollar1: testDollar1, dollar2: testDollar2, level: 1 },
        { dollar1: testDollar1, dollar2: testDollar2, level: 2 },
        { dollar1: testDollar1, dollar2: testDollar2, level: 3 }
      ];
      factory.createBatch(pairs);

      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(3);
      expect(stats.objectsInUse).toBe(3);
    });

    it('should report zero pool size for direct factory', () => {
      const level: BettingLevel = 1;
      factory.create(testDollar1, testDollar2, level);
      const stats = factory.getStatistics();
      
      expect(stats.poolSize).toBe(0);
      expect(stats.poolHitRate).toBe(0);
    });

    it('should track performance metrics when enabled', () => {
      const level: BettingLevel = 1;
      // Create several objects to generate performance data
      factory.create(testDollar1, testDollar2, level);
      factory.create(testDollar1, testDollar2, level);

      const stats = factory.getStatistics();
      expect(stats.averageCreationTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageReleaseTime).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
    });

    it('should estimate memory usage based on objects in use', () => {
      const level: BettingLevel = 1;
      factory.create(testDollar1, testDollar2, level);
      factory.create(testDollar1, testDollar2, level);

      const stats = factory.getStatistics();
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
      expect(stats.objectsInUse).toBe(2);
    });
  });

  describe('Performance Tracking', () => {
    it('should handle performance metrics when disabled', () => {
      const configWithoutMetrics = {
        ...config,
        enablePerformanceMetrics: false
      };
      const factoryNoMetrics = new DirectGameSessionFactory(configWithoutMetrics);

      const level: BettingLevel = 1;
      factoryNoMetrics.create(testDollar1, testDollar2, level);
      const stats = factoryNoMetrics.getStatistics();
      
      // Should still work but may not have detailed timing
      expect(stats).toBeDefined();
      expect(stats.objectsCreated).toBe(1);
    });

    it('should track timing when performance metrics enabled', () => {
      const level: BettingLevel = 1;
      const session = factory.create(testDollar1, testDollar2, level);
      factory.release(session);

      const stats = factory.getStatistics();
      expect(stats.averageCreationTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageReleaseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Handling', () => {
    it('should work with different configuration options', () => {
      const customConfig: PerformanceConfig = {
        enableObjectPooling: false,
        poolSizes: { virtualDollar: 0, gameSession: 0 },
        prewarmCounts: { virtualDollar: 0, gameSession: 0 },
        enableBatchOptimizations: false,
        enablePerformanceMetrics: false
      };

      const customFactory = new DirectGameSessionFactory(customConfig);
      const level: BettingLevel = 1;
      const session = customFactory.create(testDollar1, testDollar2, level);

      expect(session).toBeDefined();
      expect(session.dollar1).toBe(testDollar1);
      expect(session.dollar2).toBe(testDollar2);
      expect(session.level).toBe(level);
    });

    it('should handle batch optimization settings', () => {
      const configBatchOptimized = {
        ...config,
        enableBatchOptimizations: true
      };
      
      const batchFactory = new DirectGameSessionFactory(configBatchOptimized);
      const pairs: GamePair[] = [
        { dollar1: testDollar1, dollar2: testDollar2, level: 1 },
        { dollar1: testDollar1, dollar2: testDollar2, level: 2 }
      ];
      const sessions = batchFactory.createBatch(pairs);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].level).toBe(1);
      expect(sessions[1].level).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', () => {
      // Test with edge case level values that are still valid
      const level: BettingLevel = 10;
      const session = factory.create(testDollar1, testDollar2, level);
      expect(session).toBeDefined();
      expect(session.level).toBe(level);
      expect(session.winnings).toBe(18.0); // 10 × 1.8
    });

    it('should maintain consistent state after errors', () => {
      // Try to create with invalid level
      try {
        factory.create(testDollar1, testDollar2, 15 as BettingLevel);
      } catch (error) {
        // Ignore expected error
      }

      // Factory should still work for valid operations
      const level: BettingLevel = 1;
      const session = factory.create(testDollar1, testDollar2, level);
      expect(session).toBeDefined();
      
      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(1);
    });
  });

  describe('Interface Consistency', () => {
    it('should maintain same method signatures as pool factories', () => {
      // This test ensures the direct factory has identical interface to pooled version
      const createMethod = factory.create;
      const releaseMethod = factory.release;
      const createBatchMethod = factory.createBatch;
      const getStatsMethod = factory.getStatistics;

      expect(typeof createMethod).toBe('function');
      expect(typeof releaseMethod).toBe('function');
      expect(typeof createBatchMethod).toBe('function');
      expect(typeof getStatsMethod).toBe('function');

      // Verify method signatures work as expected
      const level: BettingLevel = 1;
      const session = createMethod.call(factory, testDollar1, testDollar2, level);
      expect(session).toBeDefined();

      releaseMethod.call(factory, session);
      
      const pairs: GamePair[] = [
        { dollar1: testDollar1, dollar2: testDollar2, level: 2 },
        { dollar1: testDollar1, dollar2: testDollar2, level: 3 }
      ];
      const sessions = createBatchMethod.call(factory, pairs);
      expect(sessions).toHaveLength(2);

      const stats = getStatsMethod.call(factory);
      expect(stats).toBeDefined();
    });
  });

  describe('Game Session Properties', () => {
    it('should set proper timestamps', () => {
      const beforeCreate = new Date();
      const level: BettingLevel = 1;
      const session = factory.create(testDollar1, testDollar2, level);
      const afterCreate = new Date();

      expect(session.timestamp).toBeDefined();
      expect(session.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(session.timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should initialize session properties correctly', () => {
      const level: BettingLevel = 5;
      const session = factory.create(testDollar1, testDollar2, level);

      expect(session.isCompleted).toBe(false);
      expect(session.winner).toBeDefined(); // Winner is set to emptyDollar
      expect(session.loser).toBeDefined(); // Loser is set to emptyDollar
      expect(session.duration).toBe(0);
      expect(session.randomSeed).toBeGreaterThanOrEqual(0);
      expect(session.randomSeed).toBeLessThan(1);
      expect(session.dailySeed).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Should be YYYY-MM-DD format
    });
  });
});