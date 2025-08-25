import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualDollar, GameSession, DollarState, BettingLevel } from '../src/types/virtual-dollar-engine';
import { GameSessionFactory, GamePair, FactoryStatistics } from '../src/types/factory-interfaces';

// Mock implementation for testing the interface contract
class MockGameSessionFactory implements GameSessionFactory {
  private createCount = 0;
  private releaseCount = 0;
  private mockSessions: GameSession[] = [];

  create(dollar1: VirtualDollar, dollar2: VirtualDollar, level: BettingLevel): GameSession {
    // Validate parameters (as per interface contract)
    if (!dollar1 || !dollar2) {
      throw new Error('Invalid virtual dollar parameters');
    }
    if (level < 1 || level > 10) {
      throw new Error('Invalid betting level');
    }

    this.createCount++;
    
    // Create empty placeholder dollar for initial assignment
    const emptyDollar: VirtualDollar = {
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
    };

    const session: GameSession = {
      id: `mock_session_${this.createCount}`,
      dollar1,
      dollar2,
      winner: emptyDollar, // Will be determined during scoring
      loser: emptyDollar,  // Will be determined during scoring
      level,
      platformFee: 0.20,
      timestamp: new Date(),
      gameNumber: this.createCount,
      dailySeed: '',
      dollar1Score: 0,
      dollar2Score: 0,
      winnings: this.calculateWinnings(level)
    };
    
    this.mockSessions.push(session);
    return session;
  }

  release(session: GameSession): void {
    this.releaseCount++;
    const index = this.mockSessions.findIndex(s => s.id === session.id);
    if (index !== -1) {
      this.mockSessions.splice(index, 1);
    }
  }

  createBatch(pairs: GamePair[]): GameSession[] {
    return pairs.map(pair => this.create(pair.dollar1, pair.dollar2, pair.level));
  }

  getStatistics(): FactoryStatistics {
    return {
      objectsCreated: this.createCount,
      objectsReleased: this.releaseCount,
      objectsInUse: this.createCount - this.releaseCount,
      poolSize: 0,
      poolHitRate: 0,
      averageCreationTime: 0.2,
      averageReleaseTime: 0.1,
      memoryUsageMB: this.mockSessions.length * 0.002 // Rough estimate
    };
  }

  private calculateWinnings(level: BettingLevel): number {
    // Simple mock calculation for testing
    return Math.pow(2, level - 1);
  }
}

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

describe('GameSessionFactory Interface Contract', () => {
  let factory: GameSessionFactory;
  let mockDollar1: VirtualDollar;
  let mockDollar2: VirtualDollar;

  beforeEach(() => {
    factory = new MockGameSessionFactory();
    mockDollar1 = createMockDollar('dollar_1', 'player_1');
    mockDollar2 = createMockDollar('dollar_2', 'player_2');
  });

  describe('create method', () => {
    it('should create a valid GameSession with all required properties', () => {
      const level = 3 as BettingLevel;
      const session = factory.create(mockDollar1, mockDollar2, level);

      // Verify all required properties exist and have correct types
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe('string');
      expect(session.id.length).toBeGreaterThan(0);

      expect(session.dollar1).toBe(mockDollar1);
      expect(session.dollar2).toBe(mockDollar2);

      expect(session.winner).toBeDefined();
      expect(session.loser).toBeDefined();

      expect(session.level).toBe(level);

      expect(typeof session.platformFee).toBe('number');
      expect(session.platformFee).toBeGreaterThan(0);

      expect(session.timestamp).toBeInstanceOf(Date);

      expect(typeof session.gameNumber).toBe('number');
      expect(session.gameNumber).toBeGreaterThan(0);

      expect(typeof session.dailySeed).toBe('string');

      expect(typeof session.dollar1Score).toBe('number');
      expect(typeof session.dollar2Score).toBe('number');

      expect(typeof session.winnings).toBe('number');
      expect(session.winnings).toBeGreaterThan(0);
    });

    it('should create unique sessions for each call', () => {
      const level = 2 as BettingLevel;
      const session1 = factory.create(mockDollar1, mockDollar2, level);
      const session2 = factory.create(mockDollar1, mockDollar2, level);

      expect(session1.id).not.toBe(session2.id);
      expect(session1.gameNumber).not.toBe(session2.gameNumber);
    });

    it('should handle different betting levels correctly', () => {
      const levels: BettingLevel[] = [1, 3, 7, 10];
      
      levels.forEach(level => {
        const session = factory.create(mockDollar1, mockDollar2, level);
        expect(session.level).toBe(level);
        expect(session.winnings).toBeGreaterThan(0);
      });
    });

    it('should accept different virtual dollar combinations', () => {
      const dollar3 = createMockDollar('dollar_3', 'player_3');
      const dollar4 = createMockDollar('dollar_4', 'player_4');
      
      const session1 = factory.create(mockDollar1, mockDollar2, 1);
      const session2 = factory.create(dollar3, dollar4, 1);

      expect(session1.dollar1).toBe(mockDollar1);
      expect(session1.dollar2).toBe(mockDollar2);
      expect(session2.dollar1).toBe(dollar3);
      expect(session2.dollar2).toBe(dollar4);
    });

    it('should throw error for invalid parameters', () => {
      expect(() => factory.create(null as any, mockDollar2, 1)).toThrow();
      expect(() => factory.create(mockDollar1, null as any, 1)).toThrow();
      expect(() => factory.create(mockDollar1, mockDollar2, 0 as BettingLevel)).toThrow();
      expect(() => factory.create(mockDollar1, mockDollar2, 11 as BettingLevel)).toThrow();
    });
  });

  describe('release method', () => {
    it('should accept a GameSession object without throwing', () => {
      const session = factory.create(mockDollar1, mockDollar2, 1);
      expect(() => factory.release(session)).not.toThrow();
    });

    it('should handle release of null or undefined gracefully', () => {
      expect(() => factory.release(null as any)).not.toThrow();
      expect(() => factory.release(undefined as any)).not.toThrow();
    });

    it('should handle multiple releases of same object gracefully', () => {
      const session = factory.create(mockDollar1, mockDollar2, 1);
      factory.release(session);
      
      // Second release should not throw
      expect(() => factory.release(session)).not.toThrow();
    });
  });

  describe('createBatch method', () => {
    it('should create multiple sessions for array of game pairs', () => {
      const pairs: GamePair[] = [
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 1 },
        { dollar1: createMockDollar('d3', 'p3'), dollar2: createMockDollar('d4', 'p4'), level: 2 },
        { dollar1: createMockDollar('d5', 'p5'), dollar2: createMockDollar('d6', 'p6'), level: 3 }
      ];

      const sessions = factory.createBatch(pairs);

      expect(sessions).toHaveLength(3);
      expect(sessions[0].level).toBe(1);
      expect(sessions[1].level).toBe(2);
      expect(sessions[2].level).toBe(3);

      // All should be valid sessions
      sessions.forEach(session => {
        expect(session.id).toBeDefined();
        expect(session.gameNumber).toBeGreaterThan(0);
        expect(session.winnings).toBeGreaterThan(0);
      });
    });

    it('should handle empty array gracefully', () => {
      const sessions = factory.createBatch([]);
      expect(sessions).toHaveLength(0);
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should create unique sessions even in batch', () => {
      const pairs: GamePair[] = [
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 1 },
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 1 }, // Same pair
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 1 }  // Same pair
      ];

      const sessions = factory.createBatch(pairs);
      expect(sessions).toHaveLength(3);
      
      // All IDs should be unique
      const ids = sessions.map(s => s.id);
      expect(new Set(ids).size).toBe(3);
      
      // All game numbers should be unique
      const gameNumbers = sessions.map(s => s.gameNumber);
      expect(new Set(gameNumbers).size).toBe(3);
    });

    it('should handle mixed betting levels in batch', () => {
      const pairs: GamePair[] = [
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 1 },
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 5 },
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 10 }
      ];

      const sessions = factory.createBatch(pairs);
      expect(sessions).toHaveLength(3);
      expect(sessions[0].level).toBe(1);
      expect(sessions[1].level).toBe(5);
      expect(sessions[2].level).toBe(10);

      // Winnings should increase with level
      expect(sessions[1].winnings).toBeGreaterThan(sessions[0].winnings);
      expect(sessions[2].winnings).toBeGreaterThan(sessions[1].winnings);
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
      const session1 = factory.create(mockDollar1, mockDollar2, 1);
      const session2 = factory.create(mockDollar1, mockDollar2, 2);
      
      stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(0);
      expect(stats.objectsInUse).toBe(2);

      // Release one object
      factory.release(session1);
      
      stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(2);
      expect(stats.objectsReleased).toBe(1);
      expect(stats.objectsInUse).toBe(1);
    });

    it('should update statistics after batch operations', () => {
      const pairs: GamePair[] = [
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 1 },
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 2 },
        { dollar1: mockDollar1, dollar2: mockDollar2, level: 3 }
      ];
      
      factory.createBatch(pairs);
      
      const stats = factory.getStatistics();
      expect(stats.objectsCreated).toBe(3);
      expect(stats.objectsInUse).toBe(3);
    });
  });

  describe('performance characteristics', () => {
    it('should create sessions efficiently', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        factory.create(mockDollar1, mockDollar2, (1 + (i % 10)) as BettingLevel);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should create 100 sessions in reasonable time
      expect(totalTime).toBeLessThan(100); // Less than 100ms for 100 objects
    });

    it('should handle batch operations efficiently', () => {
      const startTime = performance.now();
      
      const pairs: GamePair[] = Array.from({ length: 100 }, (_, i) => ({
        dollar1: mockDollar1,
        dollar2: mockDollar2,
        level: (1 + (i % 10)) as BettingLevel
      }));
      
      factory.createBatch(pairs);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Batch should be efficient
      expect(totalTime).toBeLessThan(100);
    });
  });
});