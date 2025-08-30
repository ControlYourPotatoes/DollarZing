import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VirtualDollar, DollarState, BettingLevel } from '../src/types/virtual-dollar-engine';
import { PooledVirtualDollarFactory } from '../src/types/pooled-factories';
import { PerformanceConfig } from '../src/types/factory-interfaces';

// Mock the object pool manager for testing
const mockPool = {
  acquire: vi.fn(),
  release: vi.fn(),
  initializeDollar: vi.fn(),
  size: vi.fn(() => 50),
  prewarm: vi.fn()
};

const mockPoolManager = {
  virtualDollarPool: mockPool,
  getPoolStatistics: vi.fn(() => ({
    virtualDollarPool: { size: 50, available: 50 }
  }))
};

// Mock the object pool module
vi.mock('../src/types/object-pool', () => ({
  getObjectPoolManager: vi.fn(() => mockPoolManager),
  isObjectPoolingEnabled: vi.fn(() => true)
}));

describe('PooledVirtualDollarFactory Object Pooling Behavior', () => {
  let factory: PooledVirtualDollarFactory;
  let config: PerformanceConfig;

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

    // Setup mock responses
    mockPool.acquire.mockImplementation(() => ({
      id: '',
      serialNumber: '',
      currentScore: 0,
      currentLevel: 1 as BettingLevel,
      state: DollarState.CREATED,
      ownerId: '',
      runId: '',
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true
    }));

    mockPool.initializeDollar.mockImplementation((dollar, id, serial, owner, run) => {
      dollar.id = id;
      dollar.serialNumber = serial;
      dollar.ownerId = owner;
      dollar.runId = run;
      dollar.state = DollarState.CREATED;
      return dollar;
    });

    factory = new PooledVirtualDollarFactory(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('object pool integration', () => {
    it('should acquire objects from pool when creating', () => {
      const playerId = 'test-player-123';
      const dollar = factory.create(playerId);

      expect(mockPool.acquire).toHaveBeenCalledTimes(1);
      expect(mockPool.initializeDollar).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.any(String),
        playerId,
        expect.any(String)
      );
      expect(dollar.ownerId).toBe(playerId);
    });

    it('should release objects back to pool when releasing', () => {
      const playerId = 'test-player-123';
      const dollar = factory.create(playerId);
      
      factory.release(dollar);

      expect(mockPool.release).toHaveBeenCalledTimes(1);
      expect(mockPool.release).toHaveBeenCalledWith(dollar);
    });

    it('should handle null/undefined release gracefully', () => {
      expect(() => factory.release(null as any)).not.toThrow();
      expect(() => factory.release(undefined as any)).not.toThrow();
      
      // Should not call pool release for invalid inputs
      expect(mockPool.release).not.toHaveBeenCalled();
    });

    it('should track pool hits in statistics', () => {
      const playerId = 'test-player';
      
      // Create several objects to test pool hit tracking
      factory.create(playerId);
      factory.create(playerId);
      factory.create(playerId);

      const stats = factory.getStatistics();
      expect(stats.poolHitRate).toBeGreaterThan(0);
      expect(stats.poolSize).toBeGreaterThan(0);
    });
  });

  describe('batch operations with pooling', () => {
    it('should use pool for batch creation efficiently', () => {
      const playerIds = ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'];
      const dollars = factory.createBatch(playerIds);

      // Should acquire from pool for each creation
      expect(mockPool.acquire).toHaveBeenCalledTimes(5);
      expect(mockPool.initializeDollar).toHaveBeenCalledTimes(5);
      
      expect(dollars).toHaveLength(5);
      dollars.forEach((dollar, index) => {
        expect(dollar.ownerId).toBe(playerIds[index]);
      });
    });

    it('should optimize batch operations when enabled', () => {
      const playerIds = Array.from({ length: 100 }, (_, i) => `player-${i}`);
      
      const startTime = performance.now();
      const dollars = factory.createBatch(playerIds);
      const endTime = performance.now();

      expect(dollars).toHaveLength(100);
      expect(mockPool.acquire).toHaveBeenCalledTimes(100);
      
      // Batch should be reasonably fast
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should handle empty batch gracefully', () => {
      const dollars = factory.createBatch([]);
      
      expect(dollars).toHaveLength(0);
      expect(mockPool.acquire).not.toHaveBeenCalled();
    });
  });

  describe('pool statistics and monitoring', () => {
    it('should report accurate pool statistics', () => {
      // Create and release some objects
      const dollar1 = factory.create('player-1');
      const dollar2 = factory.create('player-2');
      factory.release(dollar1);

      const stats = factory.getStatistics();
      
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(1);
      expect(stats.objectsInUse).toBe(1);
      expect(stats.poolSize).toBe(50); // From mock
      expect(typeof stats.poolHitRate).toBe('number');
      expect(stats.poolHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.poolHitRate).toBeLessThanOrEqual(1);
    });

    it('should track timing statistics', () => {
      const playerId = 'timing-test';
      const dollar = factory.create(playerId);
      factory.release(dollar);

      const stats = factory.getStatistics();
      expect(typeof stats.averageCreationTime).toBe('number');
      expect(typeof stats.averageReleaseTime).toBe('number');
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    it('should estimate memory usage appropriately', () => {
      // Create several objects
      factory.create('player-1');
      factory.create('player-2');
      factory.create('player-3');

      const stats = factory.getStatistics();
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
      expect(typeof stats.memoryUsageMB).toBe('number');
    });
  });

  describe('pool prewarming and sizing', () => {
    it('should respect pool size configuration', () => {
      const customConfig: PerformanceConfig = {
        ...config,
        poolSizes: { virtualDollar: 500, gameSession: 500 }
      };

      const customFactory = new PooledVirtualDollarFactory(customConfig);
      
      // Pool size should be reflected in statistics
      // Note: This test depends on factory implementation
      const stats = customFactory.getStatistics();
      expect(stats.poolSize).toBeGreaterThan(0);
    });

    it('should handle pool exhaustion gracefully', () => {
      // Mock pool exhaustion scenario
      mockPool.acquire.mockImplementationOnce(() => {
        throw new Error('Pool exhausted');
      });

      // Factory should handle this gracefully, either by creating directly
      // or providing appropriate error handling
      expect(() => factory.create('test-player')).toThrow();
    });
  });

  describe('performance characteristics', () => {
    it('should demonstrate pooling performance benefits', () => {
      const playerIds = Array.from({ length: 1000 }, (_, i) => `player-${i}`);
      
      const startTime = performance.now();
      const dollars = factory.createBatch(playerIds);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      
      expect(dollars).toHaveLength(1000);
      expect(mockPool.acquire).toHaveBeenCalledTimes(1000);
      
      // Should be fast with pooling
      expect(totalTime).toBeLessThan(100); // Less than 100ms for 1000 objects
      
      // Verify statistics reflect performance
      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(1000);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    it('should maintain consistent performance across multiple operations', () => {
      const times: number[] = [];
      
      // Measure multiple creation/release cycles
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const dollar = factory.create(`player-${i}`);
        factory.release(dollar);
        const end = performance.now();
        times.push(end - start);
      }
      
      // Performance should be relatively consistent
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
      
      // Variance should be low (consistent performance)
      expect(variance).toBeLessThan(avg); // Variance less than mean indicates consistency
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid player IDs appropriately', () => {
      expect(() => factory.create('')).toThrow();
      expect(() => factory.create('   ')).toThrow();
      
      // Pool should not be called for invalid inputs
      expect(mockPool.acquire).not.toHaveBeenCalled();
    });

    it('should handle pool initialization errors', () => {
      mockPool.initializeDollar.mockImplementationOnce(() => {
        throw new Error('Initialization failed');
      });

      expect(() => factory.create('test-player')).toThrow();
    });

    it('should maintain statistics accuracy even with errors', () => {
      const initialStats = factory.getStatistics();
      
      try {
        factory.create(''); // Should throw
      } catch (error) {
        // Expected
      }
      
      const afterErrorStats = factory.getStatistics();
      
      // Statistics should not be corrupted by failed operations
      expect(afterErrorStats.objectsCreated).toBe(initialStats.objectsCreated);
      expect(afterErrorStats.objectsReleased).toBe(initialStats.objectsReleased);
    });
  });
});