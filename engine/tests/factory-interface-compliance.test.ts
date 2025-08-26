// Factory Interface Compliance Tests
// Verifies that Direct and Pooled factories implement identical interfaces
// Ensures consistent API behavior across different factory implementations

import { DirectVirtualDollarFactory, DirectGameSessionFactory } from '../src/types/direct-factories';
import { PooledVirtualDollarFactory, PooledGameSessionFactory } from '../src/types/pooled-factories';
import { 
  VirtualDollarFactory, 
  GameSessionFactory, 
  FactoryStatistics, 
  DEFAULT_PERFORMANCE_CONFIG,
  PRODUCTION_PERFORMANCE_CONFIG,
  PerformanceConfig,
  GamePair 
} from '../src/types/factory-interfaces';
import { VirtualDollar, BettingLevel } from '../src/types/virtual-dollar-engine';

describe('Factory Interface Compliance', () => {
  let directVirtualFactory: DirectVirtualDollarFactory;
  let pooledVirtualFactory: PooledVirtualDollarFactory;
  let directGameFactory: DirectGameSessionFactory;
  let pooledGameFactory: PooledGameSessionFactory;
  
  let testDollar1: VirtualDollar;
  let testDollar2: VirtualDollar;

  beforeEach(() => {
    // Configure for direct factories (no pooling)
    const directConfig: PerformanceConfig = {
      ...DEFAULT_PERFORMANCE_CONFIG,
      enableObjectPooling: false,
      enablePerformanceMetrics: true
    };

    // Configure for pooled factories (with pooling)
    const pooledConfig: PerformanceConfig = {
      ...PRODUCTION_PERFORMANCE_CONFIG,
      enableObjectPooling: true,
      enablePerformanceMetrics: true,
      poolSizes: { virtualDollar: 10, gameSession: 10 }, // Small pool for testing
      prewarmCounts: { virtualDollar: 2, gameSession: 2 }
    };

    directVirtualFactory = new DirectVirtualDollarFactory(directConfig);
    pooledVirtualFactory = new PooledVirtualDollarFactory(pooledConfig);
    directGameFactory = new DirectGameSessionFactory(directConfig);
    pooledGameFactory = new PooledGameSessionFactory(pooledConfig);

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

  describe('VirtualDollarFactory Interface Compliance', () => {
    it('should implement identical interfaces', () => {
      // Both should implement VirtualDollarFactory interface
      const directInterface: VirtualDollarFactory = directVirtualFactory;
      const pooledInterface: VirtualDollarFactory = pooledVirtualFactory;

      expect(directInterface).toBeDefined();
      expect(pooledInterface).toBeDefined();

      // Both should have identical method signatures
      expect(typeof directInterface.create).toBe('function');
      expect(typeof pooledInterface.create).toBe('function');
      expect(typeof directInterface.release).toBe('function');
      expect(typeof pooledInterface.release).toBe('function');
      expect(typeof directInterface.createBatch).toBe('function');
      expect(typeof pooledInterface.createBatch).toBe('function');
      expect(typeof directInterface.getStatistics).toBe('function');
      expect(typeof pooledInterface.getStatistics).toBe('function');
    });

    it('should accept same create method parameters', () => {
      const playerId = 'test_player';

      // Both should accept same parameters without error
      expect(() => directVirtualFactory.create(playerId)).not.toThrow();
      expect(() => pooledVirtualFactory.create(playerId)).not.toThrow();

      // Both should reject invalid parameters identically
      expect(() => directVirtualFactory.create('')).toThrow();
      expect(() => pooledVirtualFactory.create('')).toThrow();
    });

    it('should return compatible VirtualDollar objects', () => {
      const playerId = 'test_player';
      const directDollar = directVirtualFactory.create(playerId);
      const pooledDollar = pooledVirtualFactory.create(playerId);

      // Both should return objects with same properties
      expect(directDollar.id).toBeDefined();
      expect(pooledDollar.id).toBeDefined();
      expect(directDollar.serialNumber).toBeDefined();
      expect(pooledDollar.serialNumber).toBeDefined();
      expect(directDollar.playerId).toBe(playerId);
      expect(pooledDollar.playerId).toBe(playerId);
      expect(directDollar.runId).toBeDefined();
      expect(pooledDollar.runId).toBeDefined();

      // Both should have same property types
      expect(typeof directDollar.id).toBe(typeof pooledDollar.id);
      expect(typeof directDollar.serialNumber).toBe(typeof pooledDollar.serialNumber);
      expect(typeof directDollar.playerId).toBe(typeof pooledDollar.playerId);
      expect(typeof directDollar.created).toBe(typeof pooledDollar.created);
    });

    it('should handle release method identically', () => {
      const playerId = 'test_player';
      const directDollar = directVirtualFactory.create(playerId);
      const pooledDollar = pooledVirtualFactory.create(playerId);

      // Both should handle release without error
      expect(() => directVirtualFactory.release(directDollar)).not.toThrow();
      expect(() => pooledVirtualFactory.release(pooledDollar)).not.toThrow();

      // Both should handle null/undefined gracefully
      expect(() => directVirtualFactory.release(null as any)).not.toThrow();
      expect(() => pooledVirtualFactory.release(null as any)).not.toThrow();
    });

    it('should handle createBatch method identically', () => {
      const playerIds = ['player1', 'player2', 'player3'];

      const directDollars = directVirtualFactory.createBatch(playerIds);
      const pooledDollars = pooledVirtualFactory.createBatch(playerIds);

      // Both should return same number of objects
      expect(directDollars).toHaveLength(3);
      expect(pooledDollars).toHaveLength(3);

      // Both should handle empty arrays identically
      expect(directVirtualFactory.createBatch([])).toEqual([]);
      expect(pooledVirtualFactory.createBatch([])).toEqual([]);
    });

    it('should return compatible FactoryStatistics', () => {
      // Create some objects to generate statistics
      directVirtualFactory.create('player1');
      pooledVirtualFactory.create('player1');

      const directStats = directVirtualFactory.getStatistics();
      const pooledStats = pooledVirtualFactory.getStatistics();

      // Both should return FactoryStatistics with same properties
      expect(typeof directStats.objectsCreated).toBe('number');
      expect(typeof pooledStats.objectsCreated).toBe('number');
      expect(typeof directStats.objectsReleased).toBe('number');
      expect(typeof pooledStats.objectsReleased).toBe('number');
      expect(typeof directStats.objectsInUse).toBe('number');
      expect(typeof pooledStats.objectsInUse).toBe('number');
      expect(typeof directStats.poolSize).toBe('number');
      expect(typeof pooledStats.poolSize).toBe('number');
      expect(typeof directStats.poolHitRate).toBe('number');
      expect(typeof pooledStats.poolHitRate).toBe('number');
      expect(typeof directStats.averageCreationTime).toBe('number');
      expect(typeof pooledStats.averageCreationTime).toBe('number');
      expect(typeof directStats.averageReleaseTime).toBe('number');
      expect(typeof pooledStats.averageReleaseTime).toBe('number');
      expect(typeof directStats.memoryUsageMB).toBe('number');
      expect(typeof pooledStats.memoryUsageMB).toBe('number');

      // Both should track created objects
      expect(directStats.objectsCreated).toBeGreaterThan(0);
      expect(pooledStats.objectsCreated).toBeGreaterThan(0);
    });
  });

  describe('GameSessionFactory Interface Compliance', () => {
    it('should implement identical interfaces', () => {
      // Both should implement GameSessionFactory interface
      const directInterface: GameSessionFactory = directGameFactory;
      const pooledInterface: GameSessionFactory = pooledGameFactory;

      expect(directInterface).toBeDefined();
      expect(pooledInterface).toBeDefined();

      // Both should have identical method signatures
      expect(typeof directInterface.create).toBe('function');
      expect(typeof pooledInterface.create).toBe('function');
      expect(typeof directInterface.release).toBe('function');
      expect(typeof pooledInterface.release).toBe('function');
      expect(typeof directInterface.createBatch).toBe('function');
      expect(typeof pooledInterface.createBatch).toBe('function');
      expect(typeof directInterface.getStatistics).toBe('function');
      expect(typeof pooledInterface.getStatistics).toBe('function');
    });

    it('should accept same create method parameters', () => {
      const level: BettingLevel = 3;

      // Both should accept same parameters without error
      expect(() => directGameFactory.create(testDollar1, testDollar2, level)).not.toThrow();
      expect(() => pooledGameFactory.create(testDollar1, testDollar2, level)).not.toThrow();

      // Both should reject invalid parameters identically
      expect(() => directGameFactory.create(null as any, testDollar2, level)).toThrow();
      expect(() => pooledGameFactory.create(null as any, testDollar2, level)).toThrow();
      expect(() => directGameFactory.create(testDollar1, testDollar2, 0 as BettingLevel)).toThrow();
      expect(() => pooledGameFactory.create(testDollar1, testDollar2, 0 as BettingLevel)).toThrow();
    });

    it('should return compatible GameSession objects', () => {
      const level: BettingLevel = 4;
      const directSession = directGameFactory.create(testDollar1, testDollar2, level);
      const pooledSession = pooledGameFactory.create(testDollar1, testDollar2, level);

      // Both should return objects with same properties
      expect(directSession.id).toBeDefined();
      expect(pooledSession.id).toBeDefined();
      expect(directSession.dollar1).toBe(testDollar1);
      expect(pooledSession.dollar1).toBe(testDollar1);
      expect(directSession.dollar2).toBe(testDollar2);
      expect(pooledSession.dollar2).toBe(testDollar2);
      expect(directSession.level).toBe(level);
      expect(pooledSession.level).toBe(level);
      expect(directSession.winnings).toBe(Math.pow(2, level - 1));
      expect(pooledSession.winnings).toBe(Math.pow(2, level - 1));

      // Both should have same property types and initial values
      expect(typeof directSession.gameNumber).toBe('number');
      expect(typeof pooledSession.gameNumber).toBe('number');
      expect(directSession.isCompleted).toBe(false);
      expect(pooledSession.isCompleted).toBe(false);
      expect(directSession.winner).toBeNull();
      expect(pooledSession.winner).toBeNull();
    });

    it('should handle release method identically', () => {
      const level: BettingLevel = 2;
      const directSession = directGameFactory.create(testDollar1, testDollar2, level);
      const pooledSession = pooledGameFactory.create(testDollar1, testDollar2, level);

      // Both should handle release without error
      expect(() => directGameFactory.release(directSession)).not.toThrow();
      expect(() => pooledGameFactory.release(pooledSession)).not.toThrow();

      // Both should handle null/undefined gracefully
      expect(() => directGameFactory.release(null as any)).not.toThrow();
      expect(() => pooledGameFactory.release(null as any)).not.toThrow();
    });

    it('should handle createBatch method identically', () => {
      const pairs: GamePair[] = [
        { dollar1: testDollar1, dollar2: testDollar2, level: 1 },
        { dollar1: testDollar1, dollar2: testDollar2, level: 2 },
        { dollar1: testDollar1, dollar2: testDollar2, level: 3 }
      ];

      const directSessions = directGameFactory.createBatch(pairs);
      const pooledSessions = pooledGameFactory.createBatch(pairs);

      // Both should return same number of objects
      expect(directSessions).toHaveLength(3);
      expect(pooledSessions).toHaveLength(3);

      // Both should handle empty arrays identically
      expect(directGameFactory.createBatch([])).toEqual([]);
      expect(pooledGameFactory.createBatch([])).toEqual([]);
    });

    it('should return compatible FactoryStatistics', () => {
      const level: BettingLevel = 1;
      // Create some objects to generate statistics
      directGameFactory.create(testDollar1, testDollar2, level);
      pooledGameFactory.create(testDollar1, testDollar2, level);

      const directStats = directGameFactory.getStatistics();
      const pooledStats = pooledGameFactory.getStatistics();

      // Both should return FactoryStatistics with same property types
      expect(typeof directStats.objectsCreated).toBe(typeof pooledStats.objectsCreated);
      expect(typeof directStats.objectsReleased).toBe(typeof pooledStats.objectsReleased);
      expect(typeof directStats.objectsInUse).toBe(typeof pooledStats.objectsInUse);
      expect(typeof directStats.poolSize).toBe(typeof pooledStats.poolSize);
      expect(typeof directStats.poolHitRate).toBe(typeof pooledStats.poolHitRate);
      expect(typeof directStats.averageCreationTime).toBe(typeof pooledStats.averageCreationTime);
      expect(typeof directStats.averageReleaseTime).toBe(typeof pooledStats.averageReleaseTime);
      expect(typeof directStats.memoryUsageMB).toBe(typeof pooledStats.memoryUsageMB);

      // Both should track created objects
      expect(directStats.objectsCreated).toBeGreaterThan(0);
      expect(pooledStats.objectsCreated).toBeGreaterThan(0);
    });
  });

  describe('Behavioral Differences While Maintaining Interface', () => {
    it('should show different pool sizes but same interface', () => {
      // Create some objects
      directVirtualFactory.create('player1');
      pooledVirtualFactory.create('player1');

      const directStats = directVirtualFactory.getStatistics();
      const pooledStats = pooledVirtualFactory.getStatistics();

      // Direct factory should have no pool
      expect(directStats.poolSize).toBe(0);
      expect(directStats.poolHitRate).toBe(0);

      // Pooled factory should have a pool
      expect(pooledStats.poolSize).toBeGreaterThan(0);
      // Hit rate may be 0 if pool was empty when object was created

      // But both should have same interface and track objects created
      expect(directStats.objectsCreated).toBe(1);
      expect(pooledStats.objectsCreated).toBe(1);
    });

    it('should handle configuration consistently', () => {
      // Both factories should accept same configuration structure
      const testConfig: PerformanceConfig = {
        enableObjectPooling: false, // This will affect behavior but not interface
        poolSizes: { virtualDollar: 5, gameSession: 5 },
        prewarmCounts: { virtualDollar: 1, gameSession: 1 },
        enableBatchOptimizations: true,
        enablePerformanceMetrics: true
      };

      const newDirectVirtual = new DirectVirtualDollarFactory(testConfig);
      const newPooledVirtual = new PooledVirtualDollarFactory(testConfig);
      const newDirectGame = new DirectGameSessionFactory(testConfig);
      const newPooledGame = new PooledGameSessionFactory(testConfig);

      // All should be created without error
      expect(newDirectVirtual).toBeDefined();
      expect(newPooledVirtual).toBeDefined();
      expect(newDirectGame).toBeDefined();
      expect(newPooledGame).toBeDefined();

      // All should implement same interfaces
      expect(newDirectVirtual.create).toBeDefined();
      expect(newPooledVirtual.create).toBeDefined();
      expect(newDirectGame.create).toBeDefined();
      expect(newPooledGame.create).toBeDefined();
    });
  });

  describe('Polymorphic Usage', () => {
    it('should be usable polymorphically through interfaces', () => {
      // Should be able to use both implementations through interface types
      const virtualFactories: VirtualDollarFactory[] = [
        directVirtualFactory,
        pooledVirtualFactory
      ];

      const gameFactories: GameSessionFactory[] = [
        directGameFactory,
        pooledGameFactory
      ];

      // All should work identically through interface
      virtualFactories.forEach(factory => {
        const dollar = factory.create('test_player');
        expect(dollar).toBeDefined();
        expect(dollar.playerId).toBe('test_player');
        
        factory.release(dollar);
        const stats = factory.getStatistics();
        expect(stats).toBeDefined();
      });

      gameFactories.forEach(factory => {
        const level: BettingLevel = 2;
        const session = factory.create(testDollar1, testDollar2, level);
        expect(session).toBeDefined();
        expect(session.level).toBe(level);
        
        factory.release(session);
        const stats = factory.getStatistics();
        expect(stats).toBeDefined();
      });
    });

    it('should support factory switching without code changes', () => {
      // Simulate runtime factory selection
      const usePooling = Math.random() > 0.5; // Random selection for test
      
      const virtualFactory: VirtualDollarFactory = usePooling 
        ? pooledVirtualFactory 
        : directVirtualFactory;
        
      const gameFactory: GameSessionFactory = usePooling 
        ? pooledGameFactory 
        : directGameFactory;

      // Should work regardless of which implementation is selected
      const dollar = virtualFactory.create('runtime_player');
      expect(dollar).toBeDefined();
      expect(dollar.playerId).toBe('runtime_player');

      const level: BettingLevel = 3;
      const session = gameFactory.create(testDollar1, testDollar2, level);
      expect(session).toBeDefined();
      expect(session.level).toBe(level);

      // Statistics should work for both
      const virtualStats = virtualFactory.getStatistics();
      const gameStats = gameFactory.getStatistics();
      expect(virtualStats.objectsCreated).toBeGreaterThan(0);
      expect(gameStats.objectsCreated).toBeGreaterThan(0);
    });
  });
});