// DirectVirtualDollarFactory Tests
// Tests for non-pooled virtual dollar factory implementation
// Validates direct object creation without pooling for development/testing scenarios

import { DirectVirtualDollarFactory } from '../src/types/direct-factories';
import { VirtualDollarFactory, DEFAULT_PERFORMANCE_CONFIG, PerformanceConfig } from '../src/types/factory-interfaces';

describe('DirectVirtualDollarFactory', () => {
  let factory: DirectVirtualDollarFactory;
  let config: PerformanceConfig;

  beforeEach(() => {
    config = {
      ...DEFAULT_PERFORMANCE_CONFIG,
      enableObjectPooling: false, // Direct factory should never use pooling
      enablePerformanceMetrics: true
    };
    factory = new DirectVirtualDollarFactory(config);
  });

  describe('Factory Interface Compliance', () => {
    it('should implement VirtualDollarFactory interface', () => {
      expect(factory).toBeDefined();
      expect(typeof factory.create).toBe('function');
      expect(typeof factory.release).toBe('function');
      expect(typeof factory.createBatch).toBe('function');
      expect(typeof factory.getStatistics).toBe('function');
    });

    it('should be instanceable through interface type', () => {
      const interfaceFactory: VirtualDollarFactory = new DirectVirtualDollarFactory(config);
      expect(interfaceFactory).toBeDefined();
      expect(interfaceFactory.create).toBeDefined();
    });
  });

  describe('Object Creation Behavior', () => {
    it('should create valid virtual dollar objects', () => {
      const ownerId = 'player123';
      const dollar = factory.create(ownerId);

      expect(dollar).toBeDefined();
      expect(dollar.id).toBeDefined();
      expect(dollar.serialNumber).toBeDefined();
      expect(dollar.ownerId).toBe(ownerId);
      expect(dollar.runId).toBeDefined();
    });

    it('should create unique objects on each call', () => {
      const ownerId = 'player123';
      const dollar1 = factory.create(ownerId);
      const dollar2 = factory.create(ownerId);

      expect(dollar1).not.toBe(dollar2);
      expect(dollar1.id).not.toBe(dollar2.id);
      expect(dollar1.serialNumber).not.toBe(dollar2.serialNumber);
    });

    it('should generate unique IDs for different players', () => {
      const dollar1 = factory.create('player1');
      const dollar2 = factory.create('player2');

      expect(dollar1.id).not.toBe(dollar2.id);
      expect(dollar1.ownerId).toBe('player1');
      expect(dollar2.ownerId).toBe('player2');
    });

    it('should throw error for empty player ID', () => {
      expect(() => factory.create('')).toThrow('Invalid player ID: cannot be empty or whitespace');
      expect(() => factory.create('   ')).toThrow('Invalid player ID: cannot be empty or whitespace');
    });

    it('should throw error for null/undefined player ID', () => {
      expect(() => factory.create(null as any)).toThrow('Invalid player ID: cannot be empty or whitespace');
      expect(() => factory.create(undefined as any)).toThrow('Invalid player ID: cannot be empty or whitespace');
    });
  });

  describe('Non-Pooled Behavior', () => {
    it('should not use object pooling', () => {
      const ownerId = 'player123';
      const dollar1 = factory.create(ownerId);
      const dollar2 = factory.create(ownerId);

      // Direct factory should always create new objects
      expect(dollar1).not.toBe(dollar2);
    });

    it('should handle release gracefully without pooling', () => {
      const ownerId = 'player123';
      const dollar = factory.create(ownerId);

      // Release should not throw error even though no pooling is used
      expect(() => factory.release(dollar)).not.toThrow();
      
      // Object should remain valid after release (no pooling means no reset)
      expect(dollar.id).toBeDefined();
      expect(dollar.ownerId).toBe(ownerId);
    });

    it('should handle null/undefined release without error', () => {
      expect(() => factory.release(null as any)).not.toThrow();
      expect(() => factory.release(undefined as any)).not.toThrow();
    });
  });

  describe('Batch Operations', () => {
    it('should create batch of virtual dollars', () => {
      const ownerIds = ['player1', 'player2', 'player3'];
      const dollars = factory.createBatch(ownerIds);

      expect(dollars).toHaveLength(3);
      expect(dollars[0].ownerId).toBe('player1');
      expect(dollars[1].ownerId).toBe('player2');
      expect(dollars[2].ownerId).toBe('player3');

      // All should be unique objects
      expect(dollars[0]).not.toBe(dollars[1]);
      expect(dollars[1]).not.toBe(dollars[2]);
    });

    it('should return empty array for empty input', () => {
      expect(factory.createBatch([])).toEqual([]);
      expect(factory.createBatch(null as any)).toEqual([]);
      expect(factory.createBatch(undefined as any)).toEqual([]);
    });

    it('should handle batch with invalid player IDs gracefully', () => {
      const ownerIds = ['player1', '', 'player3'];
      const dollars = factory.createBatch(ownerIds);

      // Should create dollars for valid IDs and skip invalid ones
      expect(dollars).toHaveLength(2);
      expect(dollars[0].ownerId).toBe('player1');
      expect(dollars[1].ownerId).toBe('player3');
    });

    it('should continue processing after individual failures', () => {
      const ownerIds = ['player1', '', 'player3', '   ', 'player5'];
      const dollars = factory.createBatch(ownerIds);

      // Should create dollars for valid IDs only
      expect(dollars).toHaveLength(3);
      expect(dollars[0].ownerId).toBe('player1');
      expect(dollars[1].ownerId).toBe('player3');
      expect(dollars[2].ownerId).toBe('player5');
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
      factory.create('player1');
      factory.create('player2');

      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsInUse).toBe(2);
    });

    it('should track object release count', () => {
      const dollar1 = factory.create('player1');
      const dollar2 = factory.create('player2');

      let stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(0);
      expect(stats.objectsInUse).toBe(2);

      factory.release(dollar1);
      stats = factory.getStatistics();
      expect(stats.objectsReleased).toBe(1);
      expect(stats.objectsInUse).toBe(1);

      factory.release(dollar2);
      stats = factory.getStatistics();
      expect(stats.objectsReleased).toBe(2);
      expect(stats.objectsInUse).toBe(0);
    });

    it('should track batch creation in statistics', () => {
      const ownerIds = ['player1', 'player2', 'player3'];
      factory.createBatch(ownerIds);

      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(3);
      expect(stats.objectsInUse).toBe(3);
    });

    it('should report zero pool size for direct factory', () => {
      factory.create('player1');
      const stats = factory.getStatistics();
      
      expect(stats.poolSize).toBe(0);
      expect(stats.poolHitRate).toBe(0);
    });

    it('should track performance metrics when enabled', () => {
      // Create several objects to generate performance data
      factory.create('player1');
      factory.create('player2');

      const stats = factory.getStatistics();
      expect(stats.averageCreationTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageReleaseTime).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
    });

    it('should estimate memory usage based on objects in use', () => {
      factory.create('player1');
      factory.create('player2');

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
      const factoryNoMetrics = new DirectVirtualDollarFactory(configWithoutMetrics);

      factoryNoMetrics.create('player1');
      const stats = factoryNoMetrics.getStatistics();
      
      // Should still work but may not have detailed timing
      expect(stats).toBeDefined();
      expect(stats.objectsCreated).toBe(1);
    });

    it('should track timing when performance metrics enabled', () => {
      const dollar = factory.create('player1');
      factory.release(dollar);

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

      const customFactory = new DirectVirtualDollarFactory(customConfig);
      const dollar = customFactory.create('player1');

      expect(dollar).toBeDefined();
      expect(dollar.ownerId).toBe('player1');
    });

    it('should handle batch optimization settings', () => {
      const configBatchOptimized = {
        ...config,
        enableBatchOptimizations: true
      };
      
      const batchFactory = new DirectVirtualDollarFactory(configBatchOptimized);
      const ownerIds = ['player1', 'player2'];
      const dollars = batchFactory.createBatch(ownerIds);

      expect(dollars).toHaveLength(2);
      expect(dollars[0].ownerId).toBe('player1');
      expect(dollars[1].ownerId).toBe('player2');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', () => {
      // Test with extreme values
      const dollar = factory.create('player_with_very_long_name_that_might_cause_issues_in_some_systems');
      expect(dollar).toBeDefined();
      expect(dollar.ownerId).toContain('player_with_very_long_name');
    });

    it('should maintain consistent state after errors', () => {
      // Try to create with invalid ID
      try {
        factory.create('');
      } catch (error) {
        // Ignore expected error
      }

      // Factory should still work for valid operations
      const dollar = factory.create('player1');
      expect(dollar).toBeDefined();
      
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
      const dollar = createMethod.call(factory, 'player1');
      expect(dollar).toBeDefined();

      releaseMethod.call(factory, dollar);
      
      const dollars = createBatchMethod.call(factory, ['player2', 'player3']);
      expect(dollars).toHaveLength(2);

      const stats = getStatsMethod.call(factory);
      expect(stats).toBeDefined();
    });
  });
});