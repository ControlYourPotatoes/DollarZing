import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualDollar, DollarState, BettingLevel } from '../src/types/virtual-dollar-engine';
import { VirtualDollarFactory, FactoryStatistics } from '../src/types/factory-interfaces';

// Mock implementation for testing the interface contract
class MockVirtualDollarFactory implements VirtualDollarFactory {
  private createCount = 0;
  private releaseCount = 0;
  private mockDollars: VirtualDollar[] = [];

  create(playerId: string): VirtualDollar {
    // Validate player ID (as per interface contract)
    if (!playerId || playerId.trim() === '') {
      throw new Error('Invalid player ID');
    }

    this.createCount++;
    const dollar: VirtualDollar = {
      id: `mock_dollar_${this.createCount}`,
      serialNumber: `M${Math.random().toString().substring(2, 10)}M`,
      currentScore: 0,
      currentLevel: 1 as BettingLevel,
      state: DollarState.CREATED,
      ownerId: playerId,
      runId: `run_${this.createCount}`,
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true
    };
    this.mockDollars.push(dollar);
    return dollar;
  }

  release(dollar: VirtualDollar): void {
    this.releaseCount++;
    // Find and remove from tracking
    const index = this.mockDollars.findIndex(d => d.id === dollar.id);
    if (index !== -1) {
      this.mockDollars.splice(index, 1);
    }
  }

  createBatch(playerIds: string[]): VirtualDollar[] {
    return playerIds.map(playerId => this.create(playerId));
  }

  getStatistics(): FactoryStatistics {
    return {
      objectsCreated: this.createCount,
      objectsReleased: this.releaseCount,
      objectsInUse: this.createCount - this.releaseCount,
      poolSize: 0, // Mock doesn't use pooling
      poolHitRate: 0,
      averageCreationTime: 0.1,
      averageReleaseTime: 0.05,
      memoryUsageMB: this.mockDollars.length * 0.001 // Rough estimate
    };
  }
}

describe('VirtualDollarFactory Interface Contract', () => {
  let factory: VirtualDollarFactory;

  beforeEach(() => {
    factory = new MockVirtualDollarFactory();
  });

  describe('create method', () => {
    it('should create a valid VirtualDollar with all required properties', () => {
      const playerId = 'test-player-123';
      const dollar = factory.create(playerId);

      // Verify all required properties exist and have correct types
      expect(dollar.id).toBeDefined();
      expect(typeof dollar.id).toBe('string');
      expect(dollar.id.length).toBeGreaterThan(0);

      expect(dollar.serialNumber).toBeDefined();
      expect(typeof dollar.serialNumber).toBe('string');
      expect(dollar.serialNumber.length).toBeGreaterThan(0);

      expect(typeof dollar.currentScore).toBe('number');
      expect(dollar.currentScore).toBe(0);

      expect(typeof dollar.currentLevel).toBe('number');
      expect(dollar.currentLevel).toBeGreaterThanOrEqual(1);
      expect(dollar.currentLevel).toBeLessThanOrEqual(10);

      expect(Object.values(DollarState)).toContain(dollar.state);
      expect(dollar.state).toBe(DollarState.CREATED);

      expect(dollar.ownerId).toBe(playerId);

      expect(dollar.runId).toBeDefined();
      expect(typeof dollar.runId).toBe('string');

      expect(dollar.createdAt).toBeInstanceOf(Date);

      expect(Array.isArray(dollar.gameHistory)).toBe(true);
      expect(dollar.gameHistory).toHaveLength(0);

      expect(typeof dollar.gamesInThisRun).toBe('number');
      expect(dollar.gamesInThisRun).toBe(0);

      expect(typeof dollar.currentRunWinnings).toBe('number');
      expect(dollar.currentRunWinnings).toBe(0);

      expect(typeof dollar.isIndependentRun).toBe('boolean');
      expect(dollar.isIndependentRun).toBe(true);
    });

    it('should create unique dollars for each call', () => {
      const playerId = 'test-player';
      const dollar1 = factory.create(playerId);
      const dollar2 = factory.create(playerId);

      expect(dollar1.id).not.toBe(dollar2.id);
      expect(dollar1.runId).not.toBe(dollar2.runId);
      expect(dollar1.serialNumber).not.toBe(dollar2.serialNumber);
    });

    it('should handle different player IDs correctly', () => {
      const player1 = 'player-1';
      const player2 = 'player-2';
      
      const dollar1 = factory.create(player1);
      const dollar2 = factory.create(player2);

      expect(dollar1.ownerId).toBe(player1);
      expect(dollar2.ownerId).toBe(player2);
    });

    it('should throw error for invalid player ID', () => {
      expect(() => factory.create('')).toThrow();
      expect(() => factory.create(' ')).toThrow();
    });
  });

  describe('release method', () => {
    it('should accept a VirtualDollar object without throwing', () => {
      const dollar = factory.create('test-player');
      expect(() => factory.release(dollar)).not.toThrow();
    });

    it('should handle release of null or undefined gracefully', () => {
      // Factory should handle invalid inputs gracefully
      expect(() => factory.release(null as any)).not.toThrow();
      expect(() => factory.release(undefined as any)).not.toThrow();
    });

    it('should handle multiple releases of same object gracefully', () => {
      const dollar = factory.create('test-player');
      factory.release(dollar);
      
      // Second release should not throw
      expect(() => factory.release(dollar)).not.toThrow();
    });
  });

  describe('createBatch method', () => {
    it('should create multiple dollars for array of player IDs', () => {
      const playerIds = ['player-1', 'player-2', 'player-3'];
      const dollars = factory.createBatch(playerIds);

      expect(dollars).toHaveLength(3);
      expect(dollars[0].ownerId).toBe('player-1');
      expect(dollars[1].ownerId).toBe('player-2');
      expect(dollars[2].ownerId).toBe('player-3');

      // All should be valid dollars
      dollars.forEach(dollar => {
        expect(dollar.id).toBeDefined();
        expect(dollar.state).toBe(DollarState.CREATED);
      });
    });

    it('should handle empty array gracefully', () => {
      const dollars = factory.createBatch([]);
      expect(dollars).toHaveLength(0);
      expect(Array.isArray(dollars)).toBe(true);
    });

    it('should create unique dollars even in batch', () => {
      const playerIds = ['player-1', 'player-1', 'player-1']; // Same player, multiple dollars
      const dollars = factory.createBatch(playerIds);

      expect(dollars).toHaveLength(3);
      
      // All IDs should be unique
      const ids = dollars.map(d => d.id);
      expect(new Set(ids).size).toBe(3);
      
      // All run IDs should be unique
      const runIds = dollars.map(d => d.runId);
      expect(new Set(runIds).size).toBe(3);
    });
  });

  describe('getStatistics method', () => {
    it('should return valid statistics object with all required properties', () => {
      const stats = factory.getStatistics();

      expect(typeof stats.objectsCreated).toBe('number');
      expect(stats.objectsCreated).toBeGreaterThanOrEqual(0);

      expect(typeof stats.objectsReleased).toBe('number');
      expect(stats.objectsReleased).toBeGreaterThanOrEqual(0);

      expect(typeof stats.objectsInUse).toBe('number');
      expect(stats.objectsInUse).toBeGreaterThanOrEqual(0);

      expect(typeof stats.poolSize).toBe('number');
      expect(stats.poolSize).toBeGreaterThanOrEqual(0);

      expect(typeof stats.poolHitRate).toBe('number');
      expect(stats.poolHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.poolHitRate).toBeLessThanOrEqual(1);

      expect(typeof stats.averageCreationTime).toBe('number');
      expect(stats.averageCreationTime).toBeGreaterThanOrEqual(0);

      expect(typeof stats.averageReleaseTime).toBe('number');
      expect(stats.averageReleaseTime).toBeGreaterThanOrEqual(0);

      expect(typeof stats.memoryUsageMB).toBe('number');
      expect(stats.memoryUsageMB).toBeGreaterThanOrEqual(0);
    });

    it('should track statistics accurately', () => {
      // Initial state
      let stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(0);
      expect(stats.objectsReleased).toBe(0);

      // Create some objects
      const dollar1 = factory.create('player-1');
      const dollar2 = factory.create('player-2');
      
      stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(0);
      expect(stats.objectsInUse).toBe(2);

      // Release one object
      factory.release(dollar1);
      
      stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(1);
      expect(stats.objectsInUse).toBe(1);
    });

    it('should update statistics after batch operations', () => {
      const playerIds = ['p1', 'p2', 'p3'];
      const dollars = factory.createBatch(playerIds);
      
      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(3);
      expect(stats.objectsInUse).toBe(3);
    });
  });

  describe('performance characteristics', () => {
    it('should create objects efficiently', () => {
      const startTime = performance.now();
      const players = Array.from({ length: 100 }, (_, i) => `player-${i}`);
      
      for (const playerId of players) {
        factory.create(playerId);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should create 100 objects in reasonable time
      expect(totalTime).toBeLessThan(100); // Less than 100ms for 100 objects
    });

    it('should handle batch operations efficiently', () => {
      const startTime = performance.now();
      const players = Array.from({ length: 100 }, (_, i) => `player-${i}`);
      
      factory.createBatch(players);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Batch should be faster than individual calls
      expect(totalTime).toBeLessThan(100);
    });
  });
});