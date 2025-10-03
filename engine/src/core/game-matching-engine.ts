// GameMatchingEngine Implementation
// Handles virtual dollar pool management, 1v1 matching, and game resolution
// Provides event-driven architecture for game tracking and analytics

import { VirtualDollar, DollarState } from "../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { ScoringEngine, ScoreResult } from "./scoring-engine";
import {
  GameSession,
  BettingLevel,
  PlayerBalanceManager,
} from "../types/virtual-dollar-engine";
import { GameSessionFactory } from "../types/factory-interfaces";
import { EventBus } from "../events/event-bus";
import {
  EVENT_TYPES,
  PoolAddedEvent,
  PoolRemovedEvent,
  PoolUpdatedEvent,
} from "../events/event-types";
import type { SimulationAbortReason } from "../types/simulation-termination";

// Legacy event types removed - using centralized EventBus instead

// Result of matching attempt
export interface GameMatchResult {
  matchesMade: number;
  gamesCreated: GameSession[];
  dollarsMatched: string[];
  timestamp: Date;
}

// Result of game resolution
export interface GameResolutionResult {
  success: boolean;
  gameId: string;
  winner?: VirtualDollar;
  loser?: VirtualDollar;
  winnings: number;
  error?: string;
}

// Pool management operation result
export interface PoolOperationResult {
  success: boolean;
  error?: string;
}

// Pool statistics interface
export interface PoolStatistics {
  totalDollarsInPool: number;
  availableForMatching: number;
  dollarsInGame: number;
  dollarsByLevel?: Record<BettingLevel, number>;
  totalGamesCompleted: number;
}

// Game statistics interface
export interface GameStatistics {
  totalGamesPlayed: number;
  gamesByLevel?: Record<BettingLevel, number>;
  totalPlatformFees: number;
  totalWinnings: number;
  resolvedGames?: number;
  gamesByLevelResolved?: Record<BettingLevel, number>;
}

// Audit trail interface
export interface AuditTrail {
  totalGames: number;
  gameHistory: GameSession[];
  lastUpdated: Date;
}

// Event listener function type removed - using centralized EventBus instead

/**
 * GameMatchingEngine - Core class for managing 1v1 game matching and resolution
 * Handles virtual dollar pool management, automatic matching, and game lifecycle
 */
const MAX_BETTING_LEVEL = 10;

interface LevelQueue {
  items: string[];
  pending: Set<string>;
}

export class GameMatchingEngine {
  private virtualDollarFactory: VirtualDollarFactory;
  private scoringEngine: ScoringEngine;
  private gameSessionFactory: GameSessionFactory;
  private playerBalanceManager?: PlayerBalanceManager;
  private eventBus: EventBus; // Required EventBus for centralized event emission

  // Pool management
  private pooledDollars: Map<string, VirtualDollar> = new Map();
  private dollarsByLevel: Map<BettingLevel, Set<string>> = new Map();
  private levelQueues: Map<BettingLevel, LevelQueue> = new Map();
  private dollarsInGame: Set<string> = new Set();

  // Game management
  private activeGames: Map<string, GameSession> = new Map();
  private completedGames: Map<string, GameSession> = new Map();
  private abortCallback: ((reason?: SimulationAbortReason) => void) | null =
    null;
  private resolvedGameCount = 0;
  private resolvedGamesByLevel: Record<BettingLevel, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
  };
  private resolvedPlatformFees = 0;
  private resolvedWinnings = 0;

  // Configuration
  private maxConcurrentGames: number = 1000;

  constructor(
    virtualDollarFactory: VirtualDollarFactory,
    scoringEngine: ScoringEngine,
    gameSessionFactory: GameSessionFactory,
    eventBus: EventBus
  ) {
    this.virtualDollarFactory = virtualDollarFactory;
    this.scoringEngine = scoringEngine;
    this.gameSessionFactory = gameSessionFactory;
    this.eventBus = eventBus;

    // Initialize level pools
    for (let level = 1; level <= MAX_BETTING_LEVEL; level++) {
      this.dollarsByLevel.set(level as BettingLevel, new Set());
      this.levelQueues.set(level as BettingLevel, {
        items: [],
        pending: new Set(),
      });
    }
  }

  private getLevelQueue(level: BettingLevel): LevelQueue {
    let queue = this.levelQueues.get(level);
    if (!queue) {
      queue = { items: [], pending: new Set() };
      this.levelQueues.set(level, queue);
    }
    return queue;
  }

  private enqueueDollar(level: BettingLevel, dollarId: string): void {
    const queue = this.getLevelQueue(level);
    queue.items.push(dollarId);
    queue.pending.add(dollarId);
  }

  private removeFromLevelQueue(level: BettingLevel, dollarId: string): void {
    const queue = this.getLevelQueue(level);
    if (!queue.pending.delete(dollarId)) {
      return;
    }

    const shouldCompact =
      queue.pending.size === 0 || queue.items.length > queue.pending.size * 2;
    if (shouldCompact) {
      queue.items = queue.items.filter((id) => queue.pending.has(id));
    }
  }

  private getQueuedDollarsSnapshot(level: BettingLevel): VirtualDollar[] {
    const queue = this.getLevelQueue(level);
    if (queue.items.length === 0 || queue.pending.size === 0) {
      return [];
    }

    const result: VirtualDollar[] = [];
    let staleCount = 0;

    for (const id of queue.items) {
      if (!queue.pending.has(id)) {
        staleCount++;
        continue;
      }

      const dollar = this.pooledDollars.get(id);
      if (!dollar || dollar.state !== DollarState.POOLED) {
        queue.pending.delete(id);
        staleCount++;
        continue;
      }

      if (this.dollarsInGame.has(id)) {
        continue;
      }

      result.push(dollar);
    }

    if (
      staleCount > 0 &&
      (queue.items.length > queue.pending.size * 2 || queue.pending.size === 0)
    ) {
      queue.items = queue.items.filter((id) => queue.pending.has(id));
    }

    return result;
  }

  private getPendingCountForLevel(level: BettingLevel): number {
    return this.getLevelQueue(level).pending.size;
  }

  /**
   * Add virtual dollar to matching pool
   */
  async addToPool(dollar: VirtualDollar): Promise<PoolOperationResult> {
    // Validate dollar state and auto-transition if needed
    if (dollar.state === DollarState.CREATED) {
      dollar.state = DollarState.POOLED; // Auto-transition CREATED → POOLED
    } else if (dollar.state !== DollarState.POOLED) {
      return {
        success: false,
        error: "Only CREATED or POOLED dollars can be added to matching pool",
      };
    }

    // Check for duplicates
    if (this.pooledDollars.has(dollar.id)) {
      return {
        success: false,
        error: "Dollar already in pool",
      };
    }

    // Validate player balance if balance manager is available
    if (
      this.playerBalanceManager &&
      !this.playerBalanceManager.canPlayerPlay(dollar.ownerId)
    ) {
      return {
        success: false,
        error: "Player does not have sufficient balance to play games",
      };
    }

    // Add to pool
    this.pooledDollars.set(dollar.id, dollar);

    // Add to level-specific pool
    const levelSet = this.dollarsByLevel.get(dollar.currentLevel);
    if (levelSet) {
      levelSet.add(dollar.id);
    }

    this.enqueueDollar(dollar.currentLevel, dollar.id);

    console.log(
      `[GameMatchingEngine] Added ${dollar.id} owned by ${dollar.ownerId} into pool at level ${dollar.currentLevel}`
    );

    // Emit POOL_ADDED event
    const poolAddedEvent: PoolAddedEvent = {
      type: EVENT_TYPES.POOL_ADDED,
      timestamp: new Date(),
      virtualDollarId: dollar.id,
      playerId: dollar.ownerId,
      currentLevel: dollar.currentLevel,
      poolSize: this.pooledDollars.size,
      availableForMatching: this.pooledDollars.size - this.dollarsInGame.size,
    };
    void this.eventBus
      .emit(EVENT_TYPES.POOL_ADDED, poolAddedEvent)
      .catch((error) =>
        console.error("[GameMatchingEngine] Failed to emit POOL_ADDED:", error)
      );

    // Emit POOL_UPDATED event
    const poolUpdatedEvent: PoolUpdatedEvent = {
      type: EVENT_TYPES.POOL_UPDATED,
      timestamp: new Date(),
      totalDollarsInPool: this.pooledDollars.size,
      availableForMatching: this.pooledDollars.size - this.dollarsInGame.size,
      dollarsInPlay: this.dollarsInGame.size,
      levelDistribution: this.getLevelDistribution(),
    };
    void this.eventBus
      .emit(EVENT_TYPES.POOL_UPDATED, poolUpdatedEvent)
      .catch((error) =>
        console.error(
          "[GameMatchingEngine] Failed to emit POOL_UPDATED:",
          error
        )
      );

    return { success: true };
  }

  /**
   * Remove virtual dollar from matching pool
   */
  async removeFromPool(
    dollarId: string,
    reason: "MATCHED_FOR_GAME" | "CASHED_OUT" | "ERROR" = "MATCHED_FOR_GAME"
  ): Promise<PoolOperationResult> {
    const dollar = this.pooledDollars.get(dollarId);
    if (!dollar) {
      return {
        success: false,
        error: "Dollar not found in pool",
      };
    }

    // Remove from main pool
    this.pooledDollars.delete(dollarId);

    // Remove from level-specific pool
    const levelSet = this.dollarsByLevel.get(dollar.currentLevel);
    if (levelSet) {
      levelSet.delete(dollarId);
    }

    this.removeFromLevelQueue(dollar.currentLevel, dollar.id);

    // Emit POOL_REMOVED event
    const poolRemovedEvent: PoolRemovedEvent = {
      type: EVENT_TYPES.POOL_REMOVED,
      timestamp: new Date(),
      virtualDollarId: dollar.id,
      playerId: dollar.ownerId,
      reason,
      poolSize: this.pooledDollars.size,
      availableForMatching: this.pooledDollars.size - this.dollarsInGame.size,
    };
    void this.eventBus
      .emit(EVENT_TYPES.POOL_REMOVED, poolRemovedEvent)
      .catch((error) =>
        console.error(
          "[GameMatchingEngine] Failed to emit POOL_REMOVED:",
          error
        )
      );

    // Emit POOL_UPDATED event
    const poolUpdatedEvent: PoolUpdatedEvent = {
      type: EVENT_TYPES.POOL_UPDATED,
      timestamp: new Date(),
      totalDollarsInPool: this.pooledDollars.size,
      availableForMatching: this.pooledDollars.size - this.dollarsInGame.size,
      dollarsInPlay: this.dollarsInGame.size,
      levelDistribution: this.getLevelDistribution(),
    };
    void this.eventBus
      .emit(EVENT_TYPES.POOL_UPDATED, poolUpdatedEvent)
      .catch((error) =>
        console.error(
          "[GameMatchingEngine] Failed to emit POOL_UPDATED:",
          error
        )
      );

    return { success: true };
  }

  // attemptMatching method removed - now handled by MatchmakingEventHandler

  /**
   * Create a new game session using injected factory
   */
  createGameSession(
    dollar1: VirtualDollar,
    dollar2: VirtualDollar,
    level: BettingLevel
  ): GameSession {
    try {
      return this.gameSessionFactory.create(dollar1, dollar2, level);
    } catch (error) {
      throw new Error(
        `Failed to create game session through factory: ${error}`
      );
    }
  }

  /**
   * Resolve a game using scoring engine and update states
   */
  resolveGame(gameId: string, dailySeed: string): GameResolutionResult {
    const game = this.activeGames.get(gameId);
    if (!game) {
      return {
        success: false,
        gameId,
        winnings: 0,
        error: "Game not found or already resolved",
      };
    }

    try {
      // Get scores from scoring engine
      const scoreResult: ScoreResult = this.scoringEngine.compareScores(
        game.dollar1.serialNumber,
        game.dollar2.serialNumber,
        dailySeed
      );

      // Update game session with resolution data
      game.dailySeed = dailySeed;
      game.dollar1Score =
        scoreResult.winnerScore === game.dollar1Score
          ? scoreResult.winnerScore
          : scoreResult.loserScore;
      game.dollar2Score =
        scoreResult.winnerScore === game.dollar2Score
          ? scoreResult.winnerScore
          : scoreResult.loserScore;

      // Determine winner and loser
      let winner: VirtualDollar;
      let loser: VirtualDollar;

      if (scoreResult.winner === game.dollar1.serialNumber) {
        winner = game.dollar1;
        loser = game.dollar2;
        game.dollar1Score = scoreResult.winnerScore;
        game.dollar2Score = scoreResult.loserScore;
      } else {
        winner = game.dollar2;
        loser = game.dollar1;
        game.dollar1Score = scoreResult.loserScore;
        game.dollar2Score = scoreResult.winnerScore;
      }

      // Update game session
      game.winner = winner;
      game.loser = loser;

      // Implement winner-takes-all pot absorption logic (Task 2.3)
      winner.potValue += loser.potValue; // Winner absorbs loser's pot value
      loser.potValue = 0; // Loser loses all pot value

      // Process player balance transactions if balance manager is available
      if (this.playerBalanceManager) {
        // No game fees charged - Virtual Dollar Pool Engine handles all fees via pot system

        // Add winnings to winner's progression
        this.playerBalanceManager.addWinProgression(
          winner.ownerId,
          game.winnings
        );

        // Clear loser's progression
        this.playerBalanceManager.loseProgression(loser.ownerId);
      }

      // Update dollar states
      // Note: Winner state will be updated later by game processing logic based on cash-out decision
      // For now, winners remain in their current state until processed
      this.virtualDollarFactory.updateDollarState(loser.id, DollarState.LOST);

      // Update dollar game history and statistics
      winner.gameHistory.push(game);
      loser.gameHistory.push(game);
      winner.gamesInThisRun++;
      loser.gamesInThisRun++;
      winner.currentRunWinnings += game.winnings;
      // Note: loser loses their currentRunWinnings (already implied by LOST state)

      // Move game from active to completed
      this.activeGames.delete(gameId);
      this.completedGames.set(gameId, game);

      // Remove from in-game tracking
      this.dollarsInGame.delete(winner.id);
      this.dollarsInGame.delete(loser.id);
      this.resolvedGameCount++;
      this.resolvedGamesByLevel[game.level] =
        (this.resolvedGamesByLevel[game.level] ?? 0) + 1;
      this.resolvedPlatformFees += game.platformFee;
      this.resolvedWinnings += game.winnings;

      // Game resolved event will be emitted by GameEventHandler

      return {
        success: true,
        gameId,
        winner,
        loser,
        winnings: game.winnings,
      };
    } catch (error) {
      return {
        success: false,
        gameId,
        winnings: 0,
        error: `Game resolution failed: ${error}`,
      };
    }
  }

  finalizeGameSession(gameId: string): void {
    const game = this.completedGames.get(gameId);
    if (!game) {
      return;
    }

    this.completedGames.delete(gameId);

    try {
      this.gameSessionFactory.release(game);
    } catch (error) {
      console.warn(
        `Warning: Failed to release game session during cleanup: ${error}`
      );
    }
  }

  /**
   * Get game session by ID
   */
  getGameSession(gameId: string): GameSession | null {
    return (
      this.activeGames.get(gameId) || this.completedGames.get(gameId) || null
    );
  }

  /**
   * Get pool statistics
   */
  getPoolStatistics(): PoolStatistics {
    const dollarsByLevel: Record<BettingLevel, number> = {} as Record<
      BettingLevel,
      number
    >;

    for (let level = 1; level <= MAX_BETTING_LEVEL; level++) {
      const bettingLevel = level as BettingLevel;
      dollarsByLevel[bettingLevel] = this.getPendingCountForLevel(bettingLevel);
    }

    return {
      totalDollarsInPool: this.pooledDollars.size + this.dollarsInGame.size,
      availableForMatching: this.pooledDollars.size,
      dollarsInGame: this.dollarsInGame.size,
      dollarsByLevel,
      totalGamesCompleted: this.completedGames.size,
    };
  }

  /**
   * Get comprehensive game statistics
   */
  getStatistics(): GameStatistics {
    const gamesByLevel = { ...this.resolvedGamesByLevel };
    const totalPlatformFees = this.resolvedPlatformFees;
    const totalWinnings = this.resolvedWinnings;

    return {
      totalGamesPlayed: this.completedGames.size,
      gamesByLevel,
      totalPlatformFees,
      totalWinnings,
      resolvedGames: this.resolvedGameCount,
      gamesByLevelResolved: { ...this.resolvedGamesByLevel },
    };
  }

  /**
   * Get audit trail of all games
   */
  getAuditTrail(): AuditTrail {
    return {
      totalGames: this.completedGames.size,
      gameHistory: Array.from(this.completedGames.values()),
      lastUpdated: new Date(),
    };
  }

  /**
   * Get games by player ID
   */
  getGamesByPlayer(playerId: string): GameSession[] {
    return Array.from(this.completedGames.values()).filter(
      (game) =>
        game.dollar1.ownerId === playerId || game.dollar2.ownerId === playerId
    );
  }

  /**
   * Get games by betting level
   */
  getGamesByLevel(level: BettingLevel): GameSession[] {
    return Array.from(this.completedGames.values()).filter(
      (game) => game.level === level
    );
  }

  /**
   * Set maximum concurrent games
   */
  setMaxConcurrentGames(max: number): void {
    if (max < 1) {
      throw new Error("Maximum concurrent games must be at least 1");
    }
    this.maxConcurrentGames = max;
  }

  /**
   * Set PlayerBalanceManager for balance validation
   */
  setPlayerBalanceManager(balanceManager: PlayerBalanceManager): void {
    this.playerBalanceManager = balanceManager;
  }

  /**
   * Set EventBus for centralized event emission
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Get EventBus instance
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  setAbortCallback(callback: (reason?: SimulationAbortReason) => void): void {
    this.abortCallback = callback;
  }

  abortSimulation(reason?: SimulationAbortReason): void {
    this.abortCallback?.(reason);
  }

  // Legacy event system methods removed - using centralized EventBus instead

  /**
   * Clear all completed games (for memory management)
   */
  clearCompletedGames(): void {
    // Release all game sessions before clearing
    for (const game of Array.from(this.completedGames.values())) {
      try {
        this.gameSessionFactory.release(game);
      } catch (error) {
        console.warn(
          `Warning: Failed to release game session during cleanup: ${error}`
        );
      }
    }
    this.completedGames.clear();
  }

  /**
   * Get active game count
   */
  getActiveGameCount(): number {
    return this.activeGames.size;
  }

  /**
   * Get active games count (alias for compatibility)
   */
  getActiveGamesCount(): number {
    return this.activeGames.size;
  }

  /**
   * Mark a virtual dollar as currently engaged in a game
   */
  markDollarInGame(dollarId: string): void {
    this.dollarsInGame.add(dollarId);
  }

  /** Release pooled dollars that are still flagged as "in game" for the given level and requeue them */
  clearStaleInGameDollars(level: BettingLevel): string[] {
    const requeueIds: string[] = [];
    const activeDollarIds = new Set<string>();

    for (const game of this.activeGames.values()) {
      activeDollarIds.add(game.dollar1.id);
      activeDollarIds.add(game.dollar2.id);
    }

    for (const dollarId of Array.from(this.dollarsInGame)) {
      if (activeDollarIds.has(dollarId)) {
        continue;
      }

      // Fetch the dollar from factory to check its level
      const dollar = this.virtualDollarFactory.getDollar(dollarId);
      if (!dollar || dollar.currentLevel !== level) {
        // Wrong level or doesn't exist - just clear the flag
        this.dollarsInGame.delete(dollarId);
        continue;
      }

      // Check if it's still in the pool
      const pooled = this.pooledDollars.get(dollarId);
      if (pooled) {
        // In pool: reset state and keep it there
        this.virtualDollarFactory.updateDollarState(
          pooled.id,
          DollarState.POOLED
        );
        this.dollarsInGame.delete(dollarId);
        requeueIds.push(pooled.id);
      } else {
        // Not in pool: force requeue it
        this.virtualDollarFactory.updateDollarState(
          dollar.id,
          DollarState.POOLED
        );
        this.forceRequeueDollar(dollar);
        this.dollarsInGame.delete(dollarId);
        requeueIds.push(dollar.id);
      }
    }

    return requeueIds;
  }

  /** Force requeue a dollar into the pool and level queue */
  forceRequeueDollar(dollar: VirtualDollar): void {
    this.pooledDollars.set(dollar.id, dollar);
    this.getLevelQueue(dollar.currentLevel).pending.add(dollar.id);
    this.getLevelQueue(dollar.currentLevel).items.push(dollar.id);
    if (!this.dollarsByLevel.has(dollar.currentLevel)) {
      this.dollarsByLevel.set(dollar.currentLevel, new Set());
    }
    this.dollarsByLevel.get(dollar.currentLevel)!.add(dollar.id);
  }

  /**
   * Get max concurrent games
   */
  getMaxConcurrentGames(): number {
    return this.maxConcurrentGames;
  }

  /**
   * Get dollars at specific level
   */
  getDollarsAtLevel(level: BettingLevel): VirtualDollar[] {
    const queueSnapshot = this.getQueuedDollarsSnapshot(level);
    if (queueSnapshot.length > 0) {
      return queueSnapshot;
    }

    const levelSet = this.dollarsByLevel.get(level);
    if (!levelSet) {
      return [];
    }

    return Array.from(levelSet)
      .map((id) => this.pooledDollars.get(id))
      .filter((dollar) => dollar !== undefined) as VirtualDollar[];
  }

  /**
   * Check if dollar is in game
   */
  isDollarInGame(dollarId: string): boolean {
    return this.dollarsInGame.has(dollarId);
  }

  /**
   * Add active game (for MatchmakingEventHandler)
   */
  addActiveGame(game: GameSession): void {
    this.activeGames.set(game.id, game);
  }

  /**
   * Get unique owners of pending queued dollars at a specific level
   */
  getQueuedOwnersAtLevel(level: BettingLevel): string[] {
    const queue = this.getLevelQueue(level);
    const owners: string[] = [];

    for (const id of queue.items) {
      if (!queue.pending.has(id)) {
        continue;
      }

      const dollar = this.pooledDollars.get(id);
      if (!dollar || dollar.state !== DollarState.POOLED) {
        continue;
      }

      owners.push(dollar.ownerId);
    }

    return owners;
  }

  /**
   * Get level distribution for pool statistics
   */
  private getLevelDistribution(): Record<number, number> {
    const distribution: Record<number, number> = {};
    for (const [level, dollarSet] of this.dollarsByLevel) {
      distribution[level] = dollarSet.size;
    }
    return distribution;
  }

  /**
   * Get factory statistics for performance monitoring
   */
  getFactoryStatistics() {
    return this.gameSessionFactory.getStatistics();
  }

  /**
   * Log global availableForMatching if negative (debug) - call from key methods like addToPool, removeFromPool, markDollarInGame
   */
  logGlobalAvailableForMatching(): void {
    const available = this.pooledDollars.size - this.dollarsInGame.size;
    if (available < 0) {
      console.warn(
        `[GameMatchingEngine] Global availableForMatching negative: ${available} (pooled: ${this.pooledDollars.size}, inGame: ${this.dollarsInGame.size})`
      );
    }
  }
}
