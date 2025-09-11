// Direct Factory Implementations
// Creates objects directly without pooling for development and testing scenarios
// Implements factory interfaces with direct object creation for clean testing

import {
  VirtualDollar,
  GameSession,
  BettingLevel,
  DollarState,
  getBettingLevelValue,
} from "./virtual-dollar-engine";
import {
  VirtualDollarFactory,
  GameSessionFactory,
  GamePair,
  FactoryStatistics,
  PerformanceConfig,
  StateTransition,
  GameResult,
} from "./factory-interfaces";

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
 * DirectVirtualDollarFactory - Implementation using direct object creation
 * Creates objects directly without pooling, ideal for development and testing
 */
export class DirectVirtualDollarFactory implements VirtualDollarFactory {
  private objectsCreated = 0;
  private objectsReleased = 0;
  private performanceTracker: PerformanceTracker;
  private config: PerformanceConfig;
  private dollarRegistry: Map<string, VirtualDollar> = new Map();

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.performanceTracker = new PerformanceTracker();
  }

  create(playerId: string): VirtualDollar {
    const startTime = this.config.enablePerformanceMetrics
      ? performance.now()
      : 0;

    // Validate player ID
    if (!playerId || playerId.trim() === "") {
      throw new Error("Invalid player ID: cannot be empty or whitespace");
    }

    try {
      // Generate unique identifiers
      const id = this.generateUniqueId();
      const serialNumber = this.generateSerialNumber();
      const runId = this.generateRunId();

      // Create new VirtualDollar directly - matching initializeDollar pattern
      const dollar: VirtualDollar = {
        id,
        serialNumber,
        currentScore: 0,
        currentLevel: 1 as BettingLevel,
        state: DollarState.CREATED,
        ownerId: playerId.trim(),
        runId,
        createdAt: new Date(),
        gameHistory: [],
        gamesInThisRun: 0,
        currentRunWinnings: 0,
        isIndependentRun: true,
        potValue: 1.0, // Starting pot value ($1.00)
      };

      this.objectsCreated++;

      // Register dollar in registry for event-driven state management
      this.dollarRegistry.set(dollar.id, dollar);

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

    // Remove from registry when released
    this.dollarRegistry.delete(dollar.id);

    // For direct factory, release is just a counter increment
    // No actual object pooling occurs
    this.objectsReleased++;

    if (this.config.enablePerformanceMetrics) {
      const endTime = performance.now();
      this.performanceTracker.recordRelease(startTime, endTime);
    }
  }

  createBatch(playerIds: string[]): VirtualDollar[] {
    if (!playerIds || playerIds.length === 0) {
      return [];
    }

    const dollars: VirtualDollar[] = [];

    if (this.config.enableBatchOptimizations) {
      // Batch-optimized creation with timing
      const startTime = this.config.enablePerformanceMetrics
        ? performance.now()
        : 0;

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

      if (this.config.enablePerformanceMetrics && dollars.length > 0) {
        const endTime = performance.now();
        // Record as single batch operation
        this.performanceTracker.recordCreation(startTime, endTime);
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
    const objectsInUse = Math.max(
      0,
      this.objectsCreated - this.objectsReleased
    );

    return {
      objectsCreated: this.objectsCreated,
      objectsReleased: this.objectsReleased,
      objectsInUse,
      poolSize: 0, // Direct factory has no pool
      poolHitRate: 0, // No pool means no hits
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
    return `vd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  // EVENT-DRIVEN STATE MANAGEMENT IMPLEMENTATION
  // ===========================================

  advancePlayerLevel(
    dollarId: string,
    newLevel: BettingLevel,
    additionalWinnings: number
  ): VirtualDollar {
    const dollar = this.findDollarById(dollarId);
    if (!dollar) {
      throw new Error(`VirtualDollar not found: ${dollarId}`);
    }

    // Validate level progression
    if (newLevel <= dollar.currentLevel || newLevel > 10) {
      throw new Error(
        `Invalid level progression: ${dollar.currentLevel} -> ${newLevel}`
      );
    }

    // Update dollar state
    dollar.currentLevel = newLevel;
    dollar.currentRunWinnings += additionalWinnings;
    dollar.gamesInThisRun += 1;

    console.log(
      `[VirtualDollarFactory] Advanced ${dollarId} to Level ${newLevel}, winnings: ${dollar.currentRunWinnings}`
    );

    return dollar;
  }

  eliminatePlayer(
    dollarId: string,
    eliminationLevel: BettingLevel
  ): VirtualDollar {
    const dollar = this.findDollarById(dollarId);
    if (!dollar) {
      throw new Error(`VirtualDollar not found: ${dollarId}`);
    }

    // Update elimination state
    dollar.state = "ELIMINATED" as any;
    dollar.currentLevel = eliminationLevel;

    console.log(
      `[VirtualDollarFactory] Eliminated ${dollarId} at Level ${eliminationLevel}`
    );

    return dollar;
  }

  completeRun(
    dollarId: string,
    completionType: "JACKPOT" | "CASH_OUT" | "ELIMINATION",
    finalWinnings: number
  ): VirtualDollar {
    const dollar = this.findDollarById(dollarId);
    if (!dollar) {
      throw new Error(`VirtualDollar not found: ${dollarId}`);
    }

    // Update completion state
    dollar.state =
      completionType === "ELIMINATION"
        ? ("ELIMINATED" as any)
        : ("COMPLETED" as any);
    dollar.currentRunWinnings = finalWinnings;

    console.log(
      `[VirtualDollarFactory] Completed run for ${dollarId}: ${completionType}, winnings: ${finalWinnings}`
    );

    return dollar;
  }

  addWinnings(dollarId: string, additionalWinnings: number): VirtualDollar {
    const dollar = this.findDollarById(dollarId);
    if (!dollar) {
      throw new Error(`VirtualDollar not found: ${dollarId}`);
    }

    dollar.currentRunWinnings += additionalWinnings;
    return dollar;
  }

  incrementGamesPlayed(dollarId: string): VirtualDollar {
    const dollar = this.findDollarById(dollarId);
    if (!dollar) {
      throw new Error(`VirtualDollar not found: ${dollarId}`);
    }

    dollar.gamesInThisRun += 1;
    return dollar;
  }

  canPlayerAdvance(dollarId: string, targetLevel: BettingLevel): boolean {
    const dollar = this.findDollarById(dollarId);
    if (!dollar) {
      return false;
    }

    return targetLevel > dollar.currentLevel && targetLevel <= 10;
  }

  calculateLevelWinnings(level: BettingLevel): number {
    // Exponential progression: Level 1 = $1, Level 2 = $2, Level 3 = $4, etc.
    return Math.pow(2, level - 1);
  }

  getPlayerState(dollarId: string): Readonly<VirtualDollar> | null {
    const dollar = this.findDollarById(dollarId);
    return dollar ? { ...dollar } : null; // Return copy to prevent mutation
  }

  // ===========================================
  // HELPER METHODS
  // ===========================================

  /**
   * Helper method to find a VirtualDollar by ID
   * Uses the internal registry to locate dollars
   */
  private findDollarById(dollarId: string): VirtualDollar | null {
    return this.dollarRegistry.get(dollarId) || null;
  }
}

/**
 * DirectGameSessionFactory - Implementation using direct object creation
 * Creates game sessions directly without pooling, ideal for development and testing
 */
export class DirectGameSessionFactory implements GameSessionFactory {
  private objectsCreated = 0;
  private objectsReleased = 0;
  private gameCounter = 0;
  private performanceTracker: PerformanceTracker;
  private config: PerformanceConfig;
  private emptyDollar: VirtualDollar;

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.performanceTracker = new PerformanceTracker();

    // Create empty dollar reference for uninitialized winner/loser
    this.emptyDollar = {
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

    try {
      this.gameCounter++;
      const id = `game_${this.gameCounter}_${Date.now()}`;
      // dailySeed will be set during game resolution

      // Create new GameSession directly - matching initializeSession pattern
      const session: GameSession = {
        id,
        dollar1,
        dollar2,
        winner: this.emptyDollar, // Will be set during game resolution
        loser: this.emptyDollar, // Will be set during game resolution
        level,
        platformFee: 0.2, // Standard 20c platform fee
        timestamp: new Date(),
        gameNumber: this.gameCounter,
        dailySeed: this.getCurrentDailySeed(),
        dollar1Score: 0, // Will be set during scoring
        dollar2Score: 0, // Will be set during scoring
        winnings: this.calculateWinnings(level),
        isCompleted: false, // New games start as incomplete
        duration: 0, // No duration until game is completed
        randomSeed: this.generateDeterministicSeed(id),
      };

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

    // For direct factory, release is just a counter increment
    // No actual object pooling occurs
    this.objectsReleased++;

    if (this.config.enablePerformanceMetrics) {
      const endTime = performance.now();
      this.performanceTracker.recordRelease(startTime, endTime);
    }
  }

  createBatch(pairs: GamePair[]): GameSession[] {
    if (!pairs || pairs.length === 0) {
      return [];
    }

    const sessions: GameSession[] = [];

    if (this.config.enableBatchOptimizations) {
      // Batch-optimized creation with timing
      const startTime = this.config.enablePerformanceMetrics
        ? performance.now()
        : 0;

      for (const pair of pairs) {
        try {
          const session = this.create(pair.dollar1, pair.dollar2, pair.level);
          sessions.push(session);
        } catch (error) {
          // Continue with other pairs if one fails
          console.warn(`Failed to create game session: ${error}`);
        }
      }

      if (this.config.enablePerformanceMetrics && sessions.length > 0) {
        const endTime = performance.now();
        // Record as single batch operation
        this.performanceTracker.recordCreation(startTime, endTime);
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
    const objectsInUse = Math.max(
      0,
      this.objectsCreated - this.objectsReleased
    );

    return {
      objectsCreated: this.objectsCreated,
      objectsReleased: this.objectsReleased,
      objectsInUse,
      poolSize: 0, // Direct factory has no pool
      poolHitRate: 0, // No pool means no hits
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

  /**
   * Generate current daily seed in YYYY-MM-DD format
   */
  private getCurrentDailySeed(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Generate deterministic random seed from game ID
   */
  private generateDeterministicSeed(gameId: string): number {
    // Simple hash function to convert string to number between 0 and 1
    let hash = 0;
    for (let i = 0; i < gameId.length; i++) {
      const char = gameId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Normalize to 0-1 range
    return Math.abs(hash) / Math.pow(2, 31);
  }
}

/**
 * Unified VirtualDollar Factory that combines state management and business logic
 * Replaces the split between VirtualDollarFactory and VirtualDollarManager
 * Provides single source of truth for VirtualDollar lifecycle and state
 */
export class UnifiedVirtualDollarFactory implements VirtualDollarFactory {
  // Internal state (unified from both Factory and Manager)
  private dollars: Map<string, VirtualDollar> = new Map();
  private serialNumbers: Set<string> = new Set();
  private pooledDollars: Set<string> = new Set();
  private dollarsByPlayer: Map<string, Set<string>> = new Map();
  private stateHistory: Map<string, StateTransition[]> = new Map();
  private performanceTracker: PerformanceTracker;

  constructor(private config: PerformanceConfig) {
    this.performanceTracker = new PerformanceTracker();
  }

  // ===========================================
  // FACTORY METHODS (Creation and Release)
  // ===========================================

  create(playerId: string): VirtualDollar {
    const startTime = performance.now();

    // Validate player ID
    if (!playerId || playerId.trim() === "") {
      throw new Error("Invalid player ID");
    }

    // Generate unique serial number with collision detection
    let serialNumber: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      serialNumber = this.generateSerialNumber();
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error("Serial number collision detected");
      }
    } while (this.serialNumbers.has(serialNumber));

    const dollar: VirtualDollar = {
      id: this.generateUniqueId(),
      serialNumber,
      currentScore: 0,
      currentLevel: 1,
      state: DollarState.CREATED,
      ownerId: playerId,
      runId: this.generateRunId(),
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true,
      potValue: 1.0,
    };

    // Store dollar and track serial number
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

    const endTime = performance.now();
    this.performanceTracker.recordCreation(startTime, endTime);

    return dollar;
  }

  release(dollar: VirtualDollar): void {
    const startTime = performance.now();
    this.releaseDollar(dollar.id);
    const endTime = performance.now();
    this.performanceTracker.recordRelease(startTime, endTime);
  }

  createBatch(playerIds: string[]): VirtualDollar[] {
    return playerIds.map((playerId) => this.create(playerId));
  }

  getStatistics(): FactoryStatistics {
    const totalCreated = this.dollars.size;
    const pooledCount = this.pooledDollars.size;
    const inUseCount = totalCreated - pooledCount;

    return {
      objectsCreated: totalCreated,
      objectsReleased: 0, // Not tracked in this implementation
      objectsInUse: inUseCount,
      poolSize: 0, // No pooling in unified factory
      poolHitRate: 0,
      averageCreationTime: this.performanceTracker.getAverageCreationTime(),
      averageReleaseTime: this.performanceTracker.getAverageReleaseTime(),
      memoryUsageMB: this.estimateMemoryUsage(),
    };
  }

  // ===========================================
  // STATE MANAGEMENT METHODS
  // ===========================================

  getDollar(dollarId: string): VirtualDollar | null {
    return this.dollars.get(dollarId) || null;
  }

  updateDollarState(dollarId: string, newState: DollarState): VirtualDollar {
    const dollar = this.dollars.get(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
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

    // Remove from tracking
    this.dollars.delete(dollarId);
    this.serialNumbers.delete(dollar.serialNumber);
    this.pooledDollars.delete(dollarId);
    this.stateHistory.delete(dollarId);

    // Remove from player tracking
    const playerDollars = this.dollarsByPlayer.get(dollar.ownerId);
    if (playerDollars) {
      playerDollars.delete(dollarId);
      if (playerDollars.size === 0) {
        this.dollarsByPlayer.delete(dollar.ownerId);
      }
    }
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

    // Update level and winnings
    dollar.currentLevel = newLevel;
    dollar.currentRunWinnings += additionalWinnings;
    dollar.gamesInThisRun += 1;

    // Update state to WON
    this.updateDollarState(dollarId, DollarState.WON);

    return dollar;
  }

  eliminatePlayer(
    dollarId: string,
    eliminationLevel: BettingLevel
  ): VirtualDollar {
    const dollar = this.getDollar(dollarId);
    if (!dollar) {
      throw new Error(`Dollar with ID ${dollarId} not found`);
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

  // ===========================================
  // ADDITIONAL BUSINESS LOGIC METHODS
  // ===========================================

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
    // Simple calculation: base winnings * level multiplier
    const baseWinnings = 50;
    const levelMultiplier = Math.pow(1.5, level - 1);
    return Math.floor(baseWinnings * levelMultiplier);
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

  private generateSerialNumber(): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const firstLetter = letters[Math.floor(Math.random() * letters.length)];
    const lastLetter = letters[Math.floor(Math.random() * letters.length)];
    const digits = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, "0");
    return `${firstLetter}${digits}${lastLetter}`;
  }

  private generateUniqueId(): string {
    return `vd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

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
      [DollarState.CREATED]: [DollarState.POOLED, DollarState.LOST], // Allow direct elimination
      [DollarState.POOLED]: [DollarState.IN_GAME, DollarState.WON], // Allow direct win from pool
      [DollarState.IN_GAME]: [DollarState.WON, DollarState.LOST],
      [DollarState.WON]: [DollarState.POOLED, DollarState.CASHED_OUT],
      [DollarState.LOST]: [], // Final state
      [DollarState.CASHED_OUT]: [], // Final state
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

  private estimateMemoryUsage(): number {
    // Rough estimation: each VirtualDollar ~1KB, plus overhead
    const dollarCount = this.dollars.size;
    const baseMemory = dollarCount * 1024; // 1KB per dollar
    const overhead = 1000; // 1KB overhead
    return (baseMemory + overhead) / (1024 * 1024); // Convert to MB
  }
}
