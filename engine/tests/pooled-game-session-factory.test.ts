import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VirtualDollar, GameSession, DollarState, BettingLevel } from '../src/types/virtual-dollar-engine';
import { PooledGameSessionFactory } from '../src/types/pooled-factories';
import { PerformanceConfig, GamePair } from '../src/types/factory-interfaces';

// Mock the object pool manager for testing
const mockPool = {
  acquire: vi.fn(),
  release: vi.fn(),
  initializeSession: vi.fn(),
  size: vi.fn(() => 30),
  prewarm: vi.fn()
};

const mockPoolManager = {
  gameSessionPool: mockPool,
  getPoolStatistics: vi.fn(() => ({
    gameSessionPool: { size: 30, available: 30 }
  }))
};

// Mock the object pool module
vi.mock('../src/types/object-pool', () => ({
  getObjectPoolManager: vi.fn(() => mockPoolManager),
  isObjectPoolingEnabled: vi.fn(() => true)
}));

// Helper function to create mock VirtualDollar
function createMockDollar(id: string, ownerId: string): VirtualDollar {
  return {
    id,
    serialNumber: `M${Math.random().toString().substring(2, 10)}M`,
    currentScore: 0,
    currentLevel: 1 as BettingLevel,
    state: DollarState.POOLED,
    ownerId,
    runId: `run_${id}`,
    createdAt: new Date(),
    gameHistory: [],
    gamesInThisRun: 0,
    currentRunWinnings: 0,
    isIndependentRun: true
  };
}

describe('PooledGameSessionFactory Object Pooling Behavior', () => {
  let factory: PooledGameSessionFactory;
  let config: PerformanceConfig;
  let mockDollar1: VirtualDollar;
  let mockDollar2: VirtualDollar;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    config = {
      enableObjectPooling: true,
      poolSizes: { virtualDollar: 1000, gameSession: 1000 },
      prewarmCounts: { virtualDollar: 100, gameSession: 100 },
      enableBatchOptimizations: true,
      enablePerformanceMetrics: true
    };

    // Create mock dollars
    mockDollar1 = createMockDollar('dollar_1', 'player_1');
    mockDollar2 = createMockDollar('dollar_2', 'player_2');

    // Setup mock session template
    const createEmptySession = (): GameSession => ({
      id: '',
      dollar1: mockDollar1,
      dollar2: mockDollar2,
      winner: mockDollar1,
      loser: mockDollar2,
      level: 1 as BettingLevel,
      platformFee: 0.20,
      timestamp: new Date(),
      gameNumber: 0,
      dailySeed: '',
      dollar1Score: 0,
      dollar2Score: 0,
      winnings: 0
    });

    // Setup mock responses
    mockPool.acquire.mockImplementation(() => createEmptySession());

    mockPool.initializeSession.mockImplementation((session, id, d1, d2, level, gameNum, seed) => {
      session.id = id;
      session.dollar1 = d1;
      session.dollar2 = d2;
      session.level = level;
      session.gameNumber = gameNum;
      session.dailySeed = seed;
      session.platformFee = 0.20;
      session.timestamp = new Date();
      return session;
    });

    factory = new PooledGameSessionFactory(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('object pool integration', () => {
    it('should acquire sessions from pool when creating', () => {
      const level = 3 as BettingLevel;
      const session = factory.create(mockDollar1, mockDollar2, level);

      expect(mockPool.acquire).toHaveBeenCalledTimes(1);
      expect(mockPool.initializeSession).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        mockDollar1,
        mockDollar2,
        level,
        expect.any(Number),
        expect.any(String)
      );
      expect(session.level).toBe(level);
    });

    it('should release sessions back to pool when releasing', () => {
      const session = factory.create(mockDollar1, mockDollar2, 1);
      
      factory.release(session);

      expect(mockPool.release).toHaveBeenCalledTimes(1);
      expect(mockPool.release).toHaveBeenCalledWith(session);
    });

    it('should handle null/undefined release gracefully', () => {
      expect(() => factory.release(null as any)).not.toThrow();
      expect(() => factory.release(undefined as any)).not.toThrow();
      
      // Should not call pool release for invalid inputs
      expect(mockPool.release).not.toHaveBeenCalled();
    });

    it('should track pool statistics correctly', () => {
      // Create and release sessions
      const session1 = factory.create(mockDollar1, mockDollar2, 1);
      const session2 = factory.create(mockDollar1, mockDollar2, 2);
      factory.release(session1);

      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(1);
      expect(stats.objectsInUse).toBe(1);
      expect(stats.poolSize).toBe(30); // From mock
    });
  });

  describe('batch operations with pooling', () => {
    it('should use pool for batch creation efficiently', () => {
      const pairs: GamePair[] = [
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 1 },
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 2 },
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 3 }
      ];

      const sessions = factory.createBatch(pairs);

      // Should acquire from pool for each creation
      expect(mockPool.acquire).toHaveBeenCalledTimes(3);
      expect(mockPool.initializeSession).toHaveBeenCalledTimes(3);
      
      expect(sessions).toHaveLength(3);
      sessions.forEach((session, index) => {
        expect(session.level).toBe(pairs[index].level);
      });
    });

    it('should optimize batch operations when enabled', () => {
      const pairs: GamePair[] = Array.from({ length: 50 }, (_, i) => ({
        dollar1: mockDollar1,
        dollar2: mockDollar2,
        level: (1 + (i % 10)) as BettingLevel
      }));
      
      const startTime = performance.now();
      const sessions = factory.createBatch(pairs);
      const endTime = performance.now();

      expect(sessions).toHaveLength(50);
      expect(mockPool.acquire).toHaveBeenCalledTimes(50);
      
      // Batch should be reasonably fast
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should handle empty batch gracefully', () => {
      const sessions = factory.createBatch([]);
      
      expect(sessions).toHaveLength(0);
      expect(mockPool.acquire).not.toHaveBeenCalled();
    });
  });

  describe('performance characteristics', () => {
    it('should demonstrate pooling performance benefits', () => {
      const pairs: GamePair[] = Array.from({ length: 200 }, (_, i) => ({
        dollar1: mockDollar1,
        dollar2: mockDollar2,
        level: (1 + (i % 10)) as BettingLevel
      }));
      
      const startTime = performance.now();
      const sessions = factory.createBatch(pairs);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      
      expect(sessions).toHaveLength(200);
      expect(mockPool.acquire).toHaveBeenCalledTimes(200);
      
      // Should be fast with pooling
      expect(totalTime).toBeLessThan(100); // Less than 100ms for 200 objects
      
      // Verify statistics reflect performance
      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(200);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    it('should maintain consistent timing across multiple operations', () => {
      const times: number[] = [];
      
      // Measure multiple creation/release cycles
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const session = factory.create(mockDollar1, mockDollar2, (1 + (i % 5)) as BettingLevel);
        factory.release(session);
        const end = performance.now();
        times.push(end - start);
      }
      
      // Performance should be relatively consistent
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
      
      // Variance should be reasonable (consistent performance)
      expect(variance).toBeLessThan(avg);
    });
  });

  describe('error handling and validation', () => {
    it('should handle invalid parameters appropriately', () => {
      expect(() => factory.create(null as any, mockDollar2, 1)).toThrow();
      expect(() => factory.create(mockDollar1, null as any, 1)).toThrow();
      expect(() => factory.create(mockDollar1, mockDollar2, 0 as BettingLevel)).toThrow();
      expect(() => factory.create(mockDollar1, mockDollar2, 11 as BettingLevel)).toThrow();
      
      // Pool should not be called for invalid inputs
      expect(mockPool.acquire).not.toHaveBeenCalled();
    });

    it('should handle pool initialization errors', () => {
      mockPool.initializeSession.mockImplementationOnce(() => {
        throw new Error('Initialization failed');
      });

      expect(() => factory.create(mockDollar1, mockDollar2, 1)).toThrow();
    });

    it('should maintain statistics accuracy even with errors', () => {
      const initialStats = factory.getStatistics();
      
      try {
        factory.create(null as any, mockDollar2, 1); // Should throw
      } catch (error) {
        // Expected
      }
      
      const afterErrorStats = factory.getStatistics();
      
      // Statistics should not be corrupted by failed operations
      expect(afterErrorStats.objectsCreated).toBe(initialStats.objectsCreated);
      expect(afterErrorStats.objectsReleased).toBe(initialStats.objectsReleased);
    });
  });

  describe('winnings calculation', () => {
    it('should calculate correct winnings for different levels', () => {
      const levels: BettingLevel[] = [1, 2, 3, 5, 8, 10];
      const expectedWinnings = [1, 2, 4, 16, 128, 512]; // 2^(level-1)
      
      levels.forEach((level, index) => {
        const session = factory.create(mockDollar1, mockDollar2, level);
        expect(session.winnings).toBe(expectedWinnings[index]);
      });
    });
  });

  describe('statistics accuracy', () => {
    it('should track timing statistics when metrics enabled', () => {
      const session = factory.create(mockDollar1, mockDollar2, 1);
      factory.release(session);

      const stats = factory.getStatistics();
      expect(typeof stats.averageCreationTime).toBe('number');
      expect(typeof stats.averageReleaseTime).toBe('number');
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    it('should calculate pool hit rate appropriately', () => {
      // Create several sessions
      factory.create(mockDollar1, mockDollar2, 1);
      factory.create(mockDollar1, mockDollar2, 2);
      factory.create(mockDollar1, mockDollar2, 3);

      const stats = factory.getStatistics();
      expect(stats.poolHitRate).toBeGreaterThan(0);
      expect(stats.poolHitRate).toBeLessThanOrEqual(1);
    });

    it('should estimate memory usage reasonably', () => {
      // Create sessions and check memory estimation
      factory.create(mockDollar1, mockDollar2, 1);
      factory.create(mockDollar1, mockDollar2, 2);

      const stats = factory.getStatistics();
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
      expect(typeof stats.memoryUsageMB).toBe('number');
    });
  });
});