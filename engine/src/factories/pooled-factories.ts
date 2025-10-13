// Pooled Factory Implementations
// Utilizes existing object pool infrastructure for performance optimization
// Implements factory interfaces with object pooling for memory efficiency

import {
  VirtualDollar,
  GameSession,
  BettingLevel,
  DollarState,
  getBettingLevelValue,
} from "../types/virtual-dollar-engine";
import {
  VirtualDollarFactory,
  GameSessionFactory,
  GamePair,
  FactoryStatistics,
  PerformanceConfig,
  StateTransition,
  GameResult,
} from "../types/factory-interfaces";
import {
  getObjectPoolManager,
  isObjectPoolingEnabled,
} from "../utils/object-pool";
import type { EventDebugInterface } from "../events/debug";

/**
 * Performance tracking utility for timing operations
 */
class PerformanceTracker {
  private creationTimes: number[] = [];
  private releaseTimes: number[] = [];
  private maxSamples = 100; // Keep last 100 samples for average calculation

  recordCreation(startTime: number, endTime: number): void {
    const duration = endTime - startTime;
    this.creationTimes.push(duration);
    if (this.creationTimes.length > this.maxSamples) {
      this.creationTimes.shift();
    }
  }

  recordRelease(startTime: number, endTime: number): void {
    const duration = endTime - startTime;
    this.releaseTimes.push(duration);
    if (this.releaseTimes.length > this.maxSamples) {
      this.releaseTimes.shift();
    }
  }

  getAverageCreationTime(): number {
    if (this.creationTimes.length === 0) return 0;
    return (
      this.creationTimes.reduce((sum, time) => sum + time, 0) /
      this.creationTimes.length
    );
  }

  getAverageReleaseTime(): number {
    if (this.releaseTimes.length === 0) return 0;
    return (
      this.releaseTimes.reduce((sum, time) => sum + time, 0) /
      this.releaseTimes.length
    );
  }

  reset(): void {
    this.creationTimes = [];
    this.releaseTimes = [];
  }
}

/**
 * PooledVirtualDollarFactory - Implementation using object pooling for performance
 * Utilizes the existing VirtualDollarPool for memory-efficient object management
 */
export class PooledVirtualDollarFactory implements VirtualDollarFactory {
  private objectsCreated = 0;
  private objectsReleased = 0;
  private performanceTracker: PerformanceTracker;
  private config: PerformanceConfig;

  // Internal state management (unified from both Factory and Manager)
  private dollars: Map<string, VirtualDollar> = new Map();
  private serialNumbers: Set<string> = new Set();
  private pooledDollars: Set<string> = new Set();
  private dollarsByPlayer: Map<string, Set<string>> = new Map();
  private stateHistory: Map<string, StateTransition[]> = new Map();

  constructor(
    config: PerformanceConfig,
    private debugInterface?: EventDebugInterface
  ) {
    this.config = config;
    this.performanceTracker = new PerformanceTracker();

    // Pre-warm pool if configured
    if (config.prewarmCounts.virtualDollar > 0 && isObjectPoolingEnabled()) {
      const poolManager = getObjectPoolManager();
      poolManager.virtualDollarPool.prewarm(config.prewarmCounts.virtualDollar);
    }
  }

  create(playerId: string): VirtualDollar {
    const startTime = this.config.enablePerformanceMetrics
      ? performance.now()
      : 0;

    // Validate player ID
    if (!playerId || playerId.trim() === "") {
      throw new Error("Invalid player ID: cannot be empty or whitespace");
    }

    if (!isObjectPoolingEnabled()) {
      throw new Error(
        "Object pooling is not enabled. Use DirectVirtualDollarFactory instead."
      );
    }

    try {
      const poolManager = getObjectPoolManager();
      const dollar = poolManager.virtualDollarPool.acquire();

      // Generate unique identifiers
      const id = this.generateUniqueId();
      const serialNumber = this.generateSerialNumber();
      const runId = this.generateRunId();

      // Initialize the pooled object
      poolManager.virtualDollarPool.initializeDollar(
        dollar,
        id,
        serialNumber,
        playerId,
        runId
      );

      // Store dollar and track serial number for state management
      this.dollars.set(dollar.id, dollar);
      this.serialNumbers.add(serialNumber);

      // Track by player
      if (!this.dollarsByPlayer.has(playerId)) {
        this.dollarsByPlayer.set(playerId, new Set());
      }
      this.dollarsByPlayer.get(playerId)!.add(dollar.id);

      // Initialize state history
      this.stateHistory.set(dollar.id, [
        {
          state: DollarState.CREATED,
          timestamp: new Date(),
        },
      ]);

      this.objectsCreated++;

      if (this.config.enablePerformanceMetrics) {
        const endTime = performance.now();
        this.performanceTracker.recordCreation(startTime, endTime);
      }

      return dollar;
    } catch (error) {
      throw new Error(`Failed to create virtual dollar: ${error}`);
    }
  }

  release(dollar: VirtualDollar): void {
    const startTime = this.config.enablePerformanceMetrics
      ? performance.now()
      : 0;

    if (!dollar) {
      return; // Handle null/undefined gracefully
    }

    if (!isObjectPoolingEnabled()) {
      return; // Nothing to do if pooling is disabled
    }

    try {
      const poolManager = getObjectPoolManager();
      const originalId = dollar.id;
      const originalSerial = dollar.serialNumber;
      const originalOwner = dollar.ownerId;

      poolManager.virtualDollarPool.release(dollar);

      // Remove from state management tracking using original identifiers
      this.dollars.delete(originalId);
      this.serialNumbers.delete(originalSerial);
      this.pooledDollars.delete(originalId);
      this.stateHistory.delete(originalId);

      // Remove from player tracking
      const playerDollars = this.dollarsByPlayer.get(originalOwner);
      if (playerDollars) {
        playerDollars.delete(originalId);
        if (playerDollars.size === 0) {
          this.dollarsByPlayer.delete(originalOwner);
        }
      }

      this.objectsReleased++;

      if (this.config.enablePerformanceMetrics) {
        const endTime = performance.now();
        this.performanceTracker.recordRelease(startTime, endTime);
      }
    } catch (error) {
      console.warn(
        `Warning: Failed to release virtual dollar to pool: ${error}`
      );
      // Don't throw - release operations should be non-critical
    }
  }

  createBatch(playerIds: string[]): VirtualDollar[] {
    if (!playerIds || playerIds.length === 0) {
      return [];
    }

    const dollars: VirtualDollar[] = [];

    if (this.config.enableBatchOptimizations) {
      // Batch-optimized creation
      const startTime = this.config.enablePerformanceMetrics
        ? performance.now()
        : 0;

      try {
        for (const playerId of playerIds) {
          const dollar = this.create(playerId);
          dollars.push(dollar);
        }

        if (this.config.enablePerformanceMetrics) {
          const endTime = performance.now();
          // Record as single batch operation
          this.performanceTracker.recordCreation(startTime, endTime);
        }
      } catch (error) {
        // If batch fails, release any created objects
        dollars.forEach((dollar) => this.release(dollar));
        throw error;
      }
    } else {
      // Individual creation fallback
      for (const playerId of playerIds) {
        try {
          const dollar = this.create(playerId);
          dollars.push(dollar);
        } catch (error) {
          // Continue with other players if one fails
          console.warn(
            `Failed to create virtual dollar for player ${playerId}: ${error}`
          );
        }
      }
    }

    return dollars;
  }

  getStatistics(): FactoryStatistics {
    const poolManager = isObjectPoolingEnabled()
      ? getObjectPoolManager()
      : null;
    const poolSize = poolManager ? poolManager.virtualDollarPool.size() : 0;
    const objectsInUse = Math.max(
      0,
      this.objectsCreated - this.objectsReleased
    );

    // Calculate pool hit rate
    const poolHitRate =
      this.objectsCreated > 0 && poolSize > 0
        ? Math.min(poolSize / this.objectsCreated, 1.0)
        : 0;

    return {
      objectsCreated: this.objectsCreated,
      objectsReleased: this.objectsReleased,
      objectsInUse,
      poolSize,
      poolHitRate,
      averageCreationTime: this.performanceTracker.getAverageCreationTime(),
      averageReleaseTime: this.performanceTracker.getAverageReleaseTime(),
      memoryUsageMB: objectsInUse * 0.001, // Rough estimate: 1KB per object
    };
  }

  /**
   * Reset factory statistics (useful for testing)
   */
  resetStatistics(): void {
    this.objectsCreated = 0;
    this.objectsReleased = 0;
    this.performanceTracker.reset();
  }

  private generateUniqueId(): string {
    return `vd_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateSerialNumber(): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const firstLetter = letters[Math.floor(Math.random() * letters.length)];
    const lastLetter = letters[Math.floor(Math.random() * letters.length)];
    const digits = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, "0");
    return `${firstLetter}${digits}${lastLetter}`;
  }

  // ===========================================
  // UNIFIED STATE MANAGEMENT METHODS
  // ===========================================

  getDollar(dollarId: string): VirtualDollar | null {
    return this.dollars.get(dollarId) || null;
  }

  updateDollarState(dollarId: string, newState: DollarState): VirtualDollar {
    const dollar = this.dollars.get(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
    }

    // Idempotent transition: if already in desired state, no-op
    if (dollar.state === newState) {
      return dollar;
    }

    // Validate state transition
    this.validateStateTransition(dollar.state, newState);

    // Update state
    dollar.state = newState;

    // Apply platform fee when entering pool for the first time
    if (newState === DollarState.POOLED && dollar.potValue === 1.0) {
      dollar.potValue -= 0.1; // Deduct 10¢ platform fee
    }

    // Track state history
    const history = this.stateHistory.get(dollarId) || [];
    history.push({
      state: newState,
      timestamp: new Date(),
    });
    this.stateHistory.set(dollarId, history);

    // Update pool tracking
    this.updatePoolTracking(dollarId, newState);

    return dollar;
  }

  getDollarsByPlayer(playerId: string): VirtualDollar[] {
    const playerDollarIds = this.dollarsByPlayer.get(playerId) || new Set();
    const dollars: VirtualDollar[] = [];

    for (const dollarId of playerDollarIds) {
      const dollar = this.dollars.get(dollarId);
      if (dollar) {
        dollars.push(dollar);
      }
    }

    return dollars;
  }

  getPooledDollars(): VirtualDollar[] {
    const pooled: VirtualDollar[] = [];
    for (const dollarId of this.pooledDollars) {
      const dollar = this.dollars.get(dollarId);
      if (dollar && dollar.state === DollarState.POOLED) {
        pooled.push(dollar);
      }
    }
    return pooled;
  }

  getDollarBySerial(serialNumber: string): VirtualDollar | null {
    for (const dollar of Array.from(this.dollars.values())) {
      if (dollar.serialNumber === serialNumber) {
        return dollar;
      }
    }
    return null;
  }

  getDollarByRunId(runId: string): VirtualDollar | null {
    for (const dollar of Array.from(this.dollars.values())) {
      if (dollar.runId === runId) {
        return dollar;
      }
    }
    return null;
  }

  getDollarStateHistory(dollarId: string): StateTransition[] {
    return this.stateHistory.get(dollarId) || [];
  }

  updateRunData(dollarId: string, winnings: number): VirtualDollar {
    const dollar = this.dollars.get(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
    }

    dollar.currentRunWinnings += winnings;
    dollar.gamesInThisRun += 1;

    return dollar;
  }

  getActiveRunsByPlayer(playerId: string): VirtualDollar[] {
    const playerDollars = this.getDollarsByPlayer(playerId);
    return playerDollars.filter(
      (dollar) =>
        dollar.state !== DollarState.CASHED_OUT &&
        dollar.state !== DollarState.LOST
    );
  }

  getCompletedRunsByPlayer(playerId: string): VirtualDollar[] {
    const playerDollars = this.getDollarsByPlayer(playerId);
    return playerDollars.filter(
      (dollar) =>
        dollar.state === DollarState.CASHED_OUT ||
        dollar.state === DollarState.LOST
    );
  }

  releaseDollar(dollarId: string): void {
    const dollar = this.dollars.get(dollarId);
    if (!dollar) {
      return;
    }

    // Use the main release method which handles pooling
    this.release(dollar);
  }

  cleanupCompletedDollars(): number {
    const completedDollars: string[] = [];
    for (const [dollarId, dollar] of this.dollars) {
      if (
        dollar.state === DollarState.CASHED_OUT ||
        dollar.state === DollarState.LOST
      ) {
        completedDollars.push(dollarId);
      }
    }

    for (const dollarId of completedDollars) {
      this.releaseDollar(dollarId);
    }

    return completedDollars.length;
  }

  // ===========================================
  // BUSINESS LOGIC METHODS
  // ===========================================

  advancePlayerLevel(
    dollarId: string,
    newLevel: BettingLevel,
    additionalWinnings: number
  ): VirtualDollar {
    const dollar = this.getDollar(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
    }

    if (dollar.state === DollarState.LOST || dollar.state === DollarState.CASHED_OUT) {
      throw new Error(
        `Cannot advance dollar ${dollarId} from final state ${dollar.state}`
      );
    }

    // Update level and winnings
    dollar.currentLevel = newLevel;
    dollar.currentRunWinnings += additionalWinnings;
    dollar.gamesInThisRun += 1;

    // Update state to WON
    this.updateDollarState(dollarId, DollarState.WON);

    if (this.debugInterface) {
      console.log(
        `[VirtualDollarFactory] advancePlayerLevel -> ${dollarId} now at level ${dollar.currentLevel}`
      );
    }

    return dollar;
  }

  eliminatePlayer(
    dollarId: string,
    _eliminationLevel: BettingLevel
  ): VirtualDollar {
    const dollar = this.getDollar(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
    }

    // Defensive check - if already eliminated, return as-is
    if (dollar.state === DollarState.LOST) {
      return dollar; // Already eliminated, no-op
    }

    // Update state to LOST
    this.updateDollarState(dollarId, DollarState.LOST);

    return dollar;
  }

  completeRun(
    dollarId: string,
    completionType: "JACKPOT" | "CASH_OUT" | "ELIMINATION",
    finalWinnings: number
  ): VirtualDollar {
    const dollar = this.getDollar(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
    }

    // Update final winnings
    dollar.currentRunWinnings = finalWinnings;

    // Set appropriate final state
    const finalState =
      completionType === "ELIMINATION"
        ? DollarState.LOST
        : DollarState.CASHED_OUT;

    this.updateDollarState(dollarId, finalState);

    return dollar;
  }

  // ===========================================
  // P2P-AWARE OPERATIONS
  // ===========================================

  processPeerToPeerGame(
    winnerId: string,
    loserId: string,
    gameResult: GameResult
  ): {
    winner: VirtualDollar;
    loser: VirtualDollar;
  } {
    const winner = this.getDollar(winnerId);
    const loser = this.getDollar(loserId);

    if (!winner) {
      throw new Error(`Winner VirtualDollar with ID ${winnerId} not found`);
    }
    if (!loser) {
      throw new Error(`Loser VirtualDollar with ID ${loserId} not found`);
    }

    // Update winner state
    this.updateDollarState(winnerId, DollarState.WON);
    this.updateRunData(winnerId, gameResult.winnings);

    // Update loser state
    this.updateDollarState(loserId, DollarState.LOST);

    return {
      winner: this.getDollar(winnerId)!,
      loser: this.getDollar(loserId)!,
    };
  }

  addWinnings(dollarId: string, additionalWinnings: number): VirtualDollar {
    const dollar = this.getDollar(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
    }

    dollar.currentRunWinnings += additionalWinnings;
    return dollar;
  }

  incrementGamesPlayed(dollarId: string): VirtualDollar {
    const dollar = this.getDollar(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
    }

    dollar.gamesInThisRun += 1;
    return dollar;
  }

  canPlayerAdvance(dollarId: string, targetLevel: BettingLevel): boolean {
    const dollar = this.getDollar(dollarId);
    if (!dollar) {
      return false;
    }

    return targetLevel > dollar.currentLevel && targetLevel <= 10;
  }

  calculateLevelWinnings(level: BettingLevel): number {
    const bettingAmount = getBettingLevelValue(level);
    return bettingAmount * 1.8;
  }

  getPlayerState(dollarId: string): Readonly<VirtualDollar> | null {
    const dollar = this.getDollar(dollarId);
    if (!dollar) {
      return null;
    }

    return Object.freeze({ ...dollar });
  }

  // ===========================================
  // PRIVATE HELPER METHODS
  // ===========================================

  private validateStateTransition(
    currentState: DollarState,
    newState: DollarState
  ): void {
    // Final states cannot transition
    if (
      currentState === DollarState.CASHED_OUT ||
      currentState === DollarState.LOST
    ) {
      throw new Error(
        `Cannot transition from final state ${currentState.toUpperCase()}`
      );
    }

    // Define valid transitions - more permissive for testing and edge cases
    const validTransitions: Record<DollarState, DollarState[]> = {
      [DollarState.CREATED]: [
        DollarState.POOLED,
        DollarState.IN_GAME,
        DollarState.WON,
        DollarState.LOST,
      ],
      [DollarState.POOLED]: [DollarState.IN_GAME, DollarState.WON],
      [DollarState.IN_GAME]: [DollarState.WON, DollarState.LOST],
      [DollarState.WON]: [DollarState.POOLED, DollarState.CASHED_OUT],
      [DollarState.LOST]: [],
      [DollarState.CASHED_OUT]: [],
    };

    if (!validTransitions[currentState].includes(newState)) {
      throw new Error(
        `Invalid state transition from ${currentState.toUpperCase()} to ${newState.toUpperCase()}`
      );
    }
  }

  private updatePoolTracking(dollarId: string, state: DollarState): void {
    if (state === DollarState.POOLED) {
      this.pooledDollars.add(dollarId);
    } else {
      this.pooledDollars.delete(dollarId);
    }
  }
}

/**
 * PooledGameSessionFactory - Implementation using object pooling for performance
 * Utilizes the existing GameSessionPool for memory-efficient object management
 */
export class PooledGameSessionFactory implements GameSessionFactory {
  private objectsCreated = 0;
  private objectsReleased = 0;
  private gameCounter = 0;
  private performanceTracker: PerformanceTracker;
  private config: PerformanceConfig;

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.performanceTracker = new PerformanceTracker();

    // Pre-warm pool if configured
    if (config.prewarmCounts.gameSession > 0 && isObjectPoolingEnabled()) {
      const poolManager = getObjectPoolManager();
      poolManager.gameSessionPool.prewarm(config.prewarmCounts.gameSession);
    }
  }

  create(
    dollar1: VirtualDollar,
    dollar2: VirtualDollar,
    level: BettingLevel
  ): GameSession {
    const startTime = this.config.enablePerformanceMetrics
      ? performance.now()
      : 0;

    // Validate parameters
    if (!dollar1 || !dollar2) {
      throw new Error(
        "Invalid virtual dollar parameters: both dollars must be provided"
      );
    }
    if (level < 1 || level > 10) {
      throw new Error("Invalid betting level: must be between 1 and 10");
    }

    if (!isObjectPoolingEnabled()) {
      throw new Error(
        "Object pooling is not enabled. Use DirectGameSessionFactory instead."
      );
    }

    try {
      const poolManager = getObjectPoolManager();
      const session = poolManager.gameSessionPool.acquire();

      this.gameCounter++;
      const id = `game_${this.gameCounter}_${Date.now()}`;
      const dailySeed = ""; // Will be set during game resolution

      // Initialize the pooled session
      poolManager.gameSessionPool.initializeSession(
        session,
        id,
        dollar1,
        dollar2,
        level,
        this.gameCounter,
        dailySeed
      );

      // Set winnings based on level
      session.winnings = this.calculateWinnings(level);

      this.objectsCreated++;

      if (this.config.enablePerformanceMetrics) {
        const endTime = performance.now();
        this.performanceTracker.recordCreation(startTime, endTime);
      }

      return session;
    } catch (error) {
      throw new Error(`Failed to create game session: ${error}`);
    }
  }

  release(session: GameSession): void {
    const startTime = this.config.enablePerformanceMetrics
      ? performance.now()
      : 0;

    if (!session) {
      return; // Handle null/undefined gracefully
    }

    if (!isObjectPoolingEnabled()) {
      return; // Nothing to do if pooling is disabled
    }

    try {
      const poolManager = getObjectPoolManager();
      poolManager.gameSessionPool.release(session);

      this.objectsReleased++;

      if (this.config.enablePerformanceMetrics) {
        const endTime = performance.now();
        this.performanceTracker.recordRelease(startTime, endTime);
      }
    } catch (error) {
      console.warn(`Warning: Failed to release game session to pool: ${error}`);
      // Don't throw - release operations should be non-critical
    }
  }

  createBatch(pairs: GamePair[]): GameSession[] {
    if (!pairs || pairs.length === 0) {
      return [];
    }

    const sessions: GameSession[] = [];

    if (this.config.enableBatchOptimizations) {
      // Batch-optimized creation
      const startTime = this.config.enablePerformanceMetrics
        ? performance.now()
        : 0;

      try {
        for (const pair of pairs) {
          const session = this.create(pair.dollar1, pair.dollar2, pair.level);
          sessions.push(session);
        }

        if (this.config.enablePerformanceMetrics) {
          const endTime = performance.now();
          // Record as single batch operation
          this.performanceTracker.recordCreation(startTime, endTime);
        }
      } catch (error) {
        // If batch fails, release any created sessions
        sessions.forEach((session) => this.release(session));
        throw error;
      }
    } else {
      // Individual creation fallback
      for (const pair of pairs) {
        try {
          const session = this.create(pair.dollar1, pair.dollar2, pair.level);
          sessions.push(session);
        } catch (error) {
          // Continue with other pairs if one fails
          console.warn(`Failed to create game session: ${error}`);
        }
      }
    }

    return sessions;
  }

  getStatistics(): FactoryStatistics {
    const poolManager = isObjectPoolingEnabled()
      ? getObjectPoolManager()
      : null;
    const poolSize = poolManager ? poolManager.gameSessionPool.size() : 0;
    const objectsInUse = Math.max(
      0,
      this.objectsCreated - this.objectsReleased
    );

    // Calculate pool hit rate
    const poolHitRate =
      this.objectsCreated > 0 && poolSize > 0
        ? Math.min(poolSize / this.objectsCreated, 1.0)
        : 0;

    return {
      objectsCreated: this.objectsCreated,
      objectsReleased: this.objectsReleased,
      objectsInUse,
      poolSize,
      poolHitRate,
      averageCreationTime: this.performanceTracker.getAverageCreationTime(),
      averageReleaseTime: this.performanceTracker.getAverageReleaseTime(),
      memoryUsageMB: objectsInUse * 0.002, // Rough estimate: 2KB per session
    };
  }

  /**
   * Reset factory statistics (useful for testing)
   */
  resetStatistics(): void {
    this.objectsCreated = 0;
    this.objectsReleased = 0;
    this.gameCounter = 0;
    this.performanceTracker.reset();
  }

  private calculateWinnings(level: BettingLevel): number {
    // Winner receives bet amount × 1.8 in winnings (per game rules)
    return getBettingLevelValue(level) * 1.8;
  }
}
