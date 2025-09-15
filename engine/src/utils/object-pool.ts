// Object Pool Implementation for Performance Optimization
// Task 9.1: Implement object pooling for GameSession and VirtualDollar objects

import {
  VirtualDollar,
  GameSession,
  DollarState,
  BettingLevel,
} from "../types/virtual-dollar-engine";

/**
 * Generic object pool interface
 */
interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

/**
 * Base object pool implementation with configurable factory and reset functions
 */
class BaseObjectPool<T> implements ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    maxSize: number = 1000
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
    // If pool is full, let object be garbage collected
  }

  size(): number {
    return this.pool.length;
  }

  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Pre-warm the pool with initial objects
   */
  prewarm(count: number): void {
    for (let i = 0; i < count && this.pool.length < this.maxSize; i++) {
      this.pool.push(this.createFn());
    }
  }
}

/**
 * Object pool specifically for VirtualDollar objects
 */
export class VirtualDollarPool extends BaseObjectPool<VirtualDollar> {
  constructor(maxSize: number = 10000) {
    const createFn = (): VirtualDollar => ({
      id: "",
      serialNumber: "",
      currentScore: 0,
      currentLevel: 1 as BettingLevel,
      state: DollarState.CREATED,
      ownerId: "",
      runId: "",
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true,
      potValue: 1.0, // Initial pot value of $1.00
    });

    const resetFn = (dollar: VirtualDollar): void => {
      dollar.id = "";
      dollar.serialNumber = "";
      dollar.currentScore = 0;
      dollar.currentLevel = 1 as BettingLevel;
      dollar.state = DollarState.CREATED;
      dollar.ownerId = "";
      dollar.runId = "";
      dollar.createdAt = new Date();
      dollar.gameHistory.length = 0; // Clear array without creating new one
      dollar.gamesInThisRun = 0;
      dollar.currentRunWinnings = 0;
      dollar.isIndependentRun = true;
      dollar.potValue = 1.0; // Reset to initial pot value of $1.00
    };

    super(createFn, resetFn, maxSize);
  }

  /**
   * Initialize a pooled VirtualDollar with specific values
   */
  initializeDollar(
    dollar: VirtualDollar,
    id: string,
    serialNumber: string,
    ownerId: string,
    runId: string
  ): VirtualDollar {
    dollar.id = id;
    dollar.serialNumber = serialNumber;
    dollar.currentScore = 0;
    dollar.currentLevel = 1 as BettingLevel;
    dollar.state = DollarState.CREATED;
    dollar.ownerId = ownerId;
    dollar.runId = runId;
    dollar.createdAt = new Date();
    dollar.gameHistory.length = 0;
    dollar.gamesInThisRun = 0;
    dollar.currentRunWinnings = 0;
    dollar.isIndependentRun = true;
    dollar.potValue = 1.0; // Initialize with $1.00 pot value

    return dollar;
  }
}

/**
 * Object pool specifically for GameSession objects
 */
export class GameSessionPool extends BaseObjectPool<GameSession> {
  private emptyDollar: VirtualDollar;

  constructor(maxSize: number = 10000) {
    // Create a reusable empty dollar reference
    const emptyDollar: VirtualDollar = {
      id: "",
      serialNumber: "",
      currentScore: 0,
      currentLevel: 1 as BettingLevel,
      state: DollarState.CREATED,
      ownerId: "",
      runId: "",
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true,
      potValue: 0, // Empty dollar has no pot value
    };

    const createFn = (): GameSession => ({
      id: "",
      dollar1: emptyDollar,
      dollar2: emptyDollar,
      winner: emptyDollar,
      loser: emptyDollar,
      level: 1 as BettingLevel,
      platformFee: 0,
      timestamp: new Date(),
      gameNumber: 0,
      dailySeed: "",
      dollar1Score: 0,
      dollar2Score: 0,
      winnings: 0,
      isCompleted: false,
      duration: 0,
      randomSeed: 0,
    });

    const resetFn = (session: GameSession): void => {
      session.id = "";
      session.dollar1 = emptyDollar;
      session.dollar2 = emptyDollar;
      session.winner = emptyDollar;
      session.loser = emptyDollar;
      session.level = 1 as BettingLevel;
      session.platformFee = 0;
      session.timestamp = new Date();
      session.gameNumber = 0;
      session.dailySeed = "";
      session.dollar1Score = 0;
      session.dollar2Score = 0;
      session.winnings = 0;
    };

    super(createFn, resetFn, maxSize);
    this.emptyDollar = emptyDollar;
  }

  /**
   * Initialize a pooled GameSession with specific values
   */
  initializeSession(
    session: GameSession,
    id: string,
    dollar1: VirtualDollar,
    dollar2: VirtualDollar,
    level: BettingLevel,
    gameNumber: number,
    dailySeed: string
  ): GameSession {
    session.id = id;
    session.dollar1 = dollar1;
    session.dollar2 = dollar2;
    session.winner = this.emptyDollar; // Will be set after scoring
    session.loser = this.emptyDollar; // Will be set after scoring
    session.level = level;
    session.platformFee = 0.2; // 20c platform fee
    session.timestamp = new Date();
    session.gameNumber = gameNumber;
    session.dailySeed = dailySeed;
    session.dollar1Score = 0; // Will be calculated
    session.dollar2Score = 0; // Will be calculated
    session.winnings = 0; // Will be calculated

    return session;
  }

  /**
   * Finalize a GameSession after scoring
   */
  finalizeSession(
    session: GameSession,
    winner: VirtualDollar,
    loser: VirtualDollar,
    dollar1Score: number,
    dollar2Score: number,
    winnings: number
  ): GameSession {
    session.winner = winner;
    session.loser = loser;
    session.dollar1Score = dollar1Score;
    session.dollar2Score = dollar2Score;
    session.winnings = winnings;

    return session;
  }
}

/**
 * Object pool manager - Centralized management of all object pools
 */
export class ObjectPoolManager {
  private static instance: ObjectPoolManager;

  public readonly virtualDollarPool: VirtualDollarPool;
  public readonly gameSessionPool: GameSessionPool;

  private constructor() {
    this.virtualDollarPool = new VirtualDollarPool(10000);
    this.gameSessionPool = new GameSessionPool(10000);

    // Pre-warm pools for better initial performance
    this.virtualDollarPool.prewarm(100);
    this.gameSessionPool.prewarm(100);
  }

  public static getInstance(): ObjectPoolManager {
    if (!ObjectPoolManager.instance) {
      ObjectPoolManager.instance = new ObjectPoolManager();
    }
    return ObjectPoolManager.instance;
  }

  /**
   * Get statistics about all pools
   */
  getPoolStatistics() {
    return {
      virtualDollarPool: {
        size: this.virtualDollarPool.size(),
        available: this.virtualDollarPool.size(),
      },
      gameSessionPool: {
        size: this.gameSessionPool.size(),
        available: this.gameSessionPool.size(),
      },
    };
  }

  /**
   * Clear all pools - useful for testing and cleanup
   */
  clearAllPools(): void {
    this.virtualDollarPool.clear();
    this.gameSessionPool.clear();
  }

  /**
   * Pre-warm all pools with initial objects
   */
  prewarmPools(dollarCount: number = 100, sessionCount: number = 100): void {
    this.virtualDollarPool.prewarm(dollarCount);
    this.gameSessionPool.prewarm(sessionCount);
  }
}

/**
 * Configuration for object pooling
 */
const ENABLE_OBJECT_POOLING =
  process.env.NODE_ENV === "production" ||
  process.env.ENABLE_POOLING === "true";

/**
 * Utility function to get the singleton object pool manager
 */
export function getObjectPoolManager(): ObjectPoolManager {
  return ObjectPoolManager.getInstance();
}

/**
 * Check if object pooling is enabled
 */
export function isObjectPoolingEnabled(): boolean {
  return ENABLE_OBJECT_POOLING;
}
