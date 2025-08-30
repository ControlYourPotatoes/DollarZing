import { describe, it, expect, beforeEach } from 'vitest';
import { FactoryStatistics } from '../src/types/factory-interfaces';

// Mock implementation for testing statistics interface
class MockStatisticsProvider {
  private createCount = 0;
  private releaseCount = 0;
  private poolSize = 100;
  private creationTimes: number[] = [];
  private releaseTimes: number[] = [];

  recordCreation(timeMs: number): void {
    this.createCount++;
    this.creationTimes.push(timeMs);
  }

  recordRelease(timeMs: number): void {
    this.releaseCount++;
    this.releaseTimes.push(timeMs);
  }

  setPoolSize(size: number): void {
    this.poolSize = size;
  }

  getStatistics(): FactoryStatistics {
    const avgCreationTime = this.creationTimes.length > 0 
      ? this.creationTimes.reduce((sum, time) => sum + time, 0) / this.creationTimes.length 
      : 0;
    
    const avgReleaseTime = this.releaseTimes.length > 0
      ? this.releaseTimes.reduce((sum, time) => sum + time, 0) / this.releaseTimes.length
      : 0;

    const poolHitRate = this.createCount > 0 
      ? Math.min(this.poolSize / this.createCount, 1.0)
      : 0;

    return {
      objectsCreated: this.createCount,
      objectsReleased: this.releaseCount,
      objectsInUse: Math.max(0, this.createCount - this.releaseCount),
      poolSize: this.poolSize,
      poolHitRate,
      averageCreationTime: avgCreationTime,
      averageReleaseTime: avgReleaseTime,
      memoryUsageMB: (this.createCount - this.releaseCount) * 0.001 // Rough estimate
    };
  }

  reset(): void {
    this.createCount = 0;
    this.releaseCount = 0;
    this.poolSize = 100;
    this.creationTimes = [];
    this.releaseTimes = [];
  }
}

describe('FactoryStatistics Interface and Data Structures', () => {
  let provider: MockStatisticsProvider;

  beforeEach(() => {
    provider = new MockStatisticsProvider();
  });

  describe('FactoryStatistics interface structure', () => {
    it('should have all required properties with correct types', () => {
      const stats = provider.getStatistics();

      // Verify property existence and types
      expect(typeof stats.objectsCreated).toBe('number');
      expect(typeof stats.objectsReleased).toBe('number');  
      expect(typeof stats.objectsInUse).toBe('number');
      expect(typeof stats.poolSize).toBe('number');
      expect(typeof stats.poolHitRate).toBe('number');
      expect(typeof stats.averageCreationTime).toBe('number');
      expect(typeof stats.averageReleaseTime).toBe('number');
      expect(typeof stats.memoryUsageMB).toBe('number');
    });

    it('should have non-negative counter properties', () => {
      const stats = provider.getStatistics();

      expect(stats.objectsCreated).toBeGreaterThanOrEqual(0);
      expect(stats.objectsReleased).toBeGreaterThanOrEqual(0);
      expect(stats.objectsInUse).toBeGreaterThanOrEqual(0);
      expect(stats.poolSize).toBeGreaterThanOrEqual(0);
    });

    it('should have valid rate properties', () => {
      const stats = provider.getStatistics();

      expect(stats.poolHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.poolHitRate).toBeLessThanOrEqual(1);
    });

    it('should have non-negative performance metrics', () => {
      const stats = provider.getStatistics();

      expect(stats.averageCreationTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageReleaseTime).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsageMB).toBeGreaterThanOrEqual(0);
    });
  });

  describe('statistics tracking accuracy', () => {
    it('should accurately track object creation count', () => {
      let stats = provider.getStatistics();
      expect(stats.objectsCreated).toBe(0);

      provider.recordCreation(1.0);
      stats = provider.getStatistics();
      expect(stats.objectsCreated).toBe(1);

      provider.recordCreation(1.5);
      provider.recordCreation(2.0);
      stats = provider.getStatistics();
      expect(stats.objectsCreated).toBe(3);
    });

    it('should accurately track object release count', () => {
      let stats = provider.getStatistics();
      expect(stats.objectsReleased).toBe(0);

      provider.recordRelease(0.5);
      stats = provider.getStatistics();
      expect(stats.objectsReleased).toBe(1);

      provider.recordRelease(0.3);
      provider.recordRelease(0.7);
      stats = provider.getStatistics();
      expect(stats.objectsReleased).toBe(3);
    });

    it('should correctly calculate objects in use', () => {
      // Initially no objects
      let stats = provider.getStatistics();
      expect(stats.objectsInUse).toBe(0);

      // Create 5 objects
      for (let i = 0; i < 5; i++) {
        provider.recordCreation(1.0);
      }
      stats = provider.getStatistics();
      expect(stats.objectsInUse).toBe(5);

      // Release 2 objects
      provider.recordRelease(0.5);
      provider.recordRelease(0.5);
      stats = provider.getStatistics();
      expect(stats.objectsInUse).toBe(3);

      // Release remaining objects
      provider.recordRelease(0.5);
      provider.recordRelease(0.5);
      provider.recordRelease(0.5);
      stats = provider.getStatistics();
      expect(stats.objectsInUse).toBe(0);
    });

    it('should handle over-release gracefully', () => {
      // Create 2 objects
      provider.recordCreation(1.0);
      provider.recordCreation(1.0);

      // Release 3 objects (over-release)
      provider.recordRelease(0.5);
      provider.recordRelease(0.5);
      provider.recordRelease(0.5);

      const stats = provider.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(3);
      expect(stats.objectsInUse).toBe(0); // Should not go negative
    });
  });

  describe('performance metrics calculation', () => {
    it('should calculate average creation time correctly', () => {
      provider.recordCreation(1.0);
      provider.recordCreation(2.0);
      provider.recordCreation(3.0);

      const stats = provider.getStatistics();
      expect(stats.averageCreationTime).toBe(2.0); // (1+2+3)/3 = 2
    });

    it('should calculate average release time correctly', () => {
      provider.recordRelease(0.5);
      provider.recordRelease(1.0);
      provider.recordRelease(1.5);

      const stats = provider.getStatistics();
      expect(stats.averageReleaseTime).toBe(1.0); // (0.5+1+1.5)/3 = 1
    });

    it('should handle zero operations gracefully', () => {
      const stats = provider.getStatistics();
      
      expect(stats.averageCreationTime).toBe(0);
      expect(stats.averageReleaseTime).toBe(0);
      expect(stats.poolHitRate).toBe(0);
    });

    it('should calculate pool hit rate correctly', () => {
      provider.setPoolSize(50);

      // Test with fewer creates than pool size
      provider.recordCreation(1.0);
      provider.recordCreation(1.0);
      let stats = provider.getStatistics();
      expect(stats.poolHitRate).toBe(1.0); // Pool can satisfy all requests

      // Test with more creates than pool size  
      for (let i = 0; i < 100; i++) {
        provider.recordCreation(1.0);
      }
      stats = provider.getStatistics();
      expect(stats.poolHitRate).toBeLessThan(1.0); // Pool cannot satisfy all requests
    });
  });

  describe('pool size tracking', () => {
    it('should track pool size changes', () => {
      provider.setPoolSize(200);
      let stats = provider.getStatistics();
      expect(stats.poolSize).toBe(200);

      provider.setPoolSize(500);
      stats = provider.getStatistics();
      expect(stats.poolSize).toBe(500);
    });

    it('should handle zero pool size', () => {
      provider.setPoolSize(0);
      const stats = provider.getStatistics();
      expect(stats.poolSize).toBe(0);
      expect(stats.poolHitRate).toBe(0);
    });
  });

  describe('memory usage estimation', () => {
    it('should provide reasonable memory usage estimates', () => {
      const stats = provider.getStatistics();
      expect(stats.memoryUsageMB).toBeGreaterThanOrEqual(0);

      // Create some objects
      provider.recordCreation(1.0);
      provider.recordCreation(1.0);
      
      const statsAfter = provider.getStatistics();
      expect(statsAfter.memoryUsageMB).toBeGreaterThan(stats.memoryUsageMB);
    });

    it('should update memory usage when objects are released', () => {
      // Create objects
      provider.recordCreation(1.0);
      provider.recordCreation(1.0);
      const statsWithObjects = provider.getStatistics();

      // Release objects
      provider.recordRelease(0.5);
      provider.recordRelease(0.5);
      const statsAfterRelease = provider.getStatistics();

      expect(statsAfterRelease.memoryUsageMB).toBeLessThan(statsWithObjects.memoryUsageMB);
    });
  });

  describe('data consistency', () => {
    it('should maintain consistency between related metrics', () => {
      // Create and release various amounts
      for (let i = 0; i < 10; i++) {
        provider.recordCreation(1.0 + Math.random());
      }
      
      for (let i = 0; i < 6; i++) {
        provider.recordRelease(0.5 + Math.random() * 0.5);
      }

      const stats = provider.getStatistics();

      // Verify consistency rules
      expect(stats.objectsInUse).toBe(stats.objectsCreated - stats.objectsReleased);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
      expect(stats.averageReleaseTime).toBeGreaterThan(0);
    });

    it('should provide stable statistics across multiple calls', () => {
      provider.recordCreation(1.0);
      provider.recordRelease(0.5);

      const stats1 = provider.getStatistics();
      const stats2 = provider.getStatistics();

      expect(stats1.objectsCreated).toBe(stats2.objectsCreated);
      expect(stats1.objectsReleased).toBe(stats2.objectsReleased);
      expect(stats1.objectsInUse).toBe(stats2.objectsInUse);
      expect(stats1.averageCreationTime).toBe(stats2.averageCreationTime);
      expect(stats1.averageReleaseTime).toBe(stats2.averageReleaseTime);
    });
  });

  describe('reset functionality', () => {
    it('should reset all statistics to initial state', () => {
      // Generate some statistics
      provider.recordCreation(2.0);
      provider.recordCreation(1.5);
      provider.recordRelease(0.8);
      provider.setPoolSize(150);

      // Verify statistics exist
      let stats = provider.getStatistics();
      expect(stats.objectsCreated).toBeGreaterThan(0);
      expect(stats.objectsReleased).toBeGreaterThan(0);

      // Reset
      provider.reset();

      // Verify reset state
      stats = provider.getStatistics();
      expect(stats.objectsCreated).toBe(0);
      expect(stats.objectsReleased).toBe(0);
      expect(stats.objectsInUse).toBe(0);
      expect(stats.averageCreationTime).toBe(0);
      expect(stats.averageReleaseTime).toBe(0);
      expect(stats.poolSize).toBe(100); // Default pool size
    });
  });
});