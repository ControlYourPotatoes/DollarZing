// Factory Pattern Interfaces for Virtual Dollar and Game Session Creation
// Provides abstraction layer for object creation with dependency injection support
// Enables performance optimization through object pooling while maintaining clean code

import {
  VirtualDollar,
  GameSession,
  BettingLevel,
  DollarState,
} from "./virtual-dollar-engine";

/**
 * State transition record for tracking VirtualDollar state changes
 */
export interface StateTransition {
  state: DollarState;
  timestamp: Date;
}

/**
 * Game result for P2P operations
 */
export interface GameResult {
  winnerId: string;
  loserId: string;
  winnings: number;
  gameId: string;
}

/**
 * Statistics interface for factory performance monitoring
 * Tracks object creation, pooling efficiency, and performance metrics
 */
export interface FactoryStatistics {
  objectsCreated: number; // Total objects created since initialization
  objectsReleased: number; // Total objects released back to factory
  objectsInUse: number; // Currently active objects not yet released
  poolSize: number; // Current size of object pool (0 for direct factories)
  poolHitRate: number; // Percentage of creates satisfied from pool (0-1)
  averageCreationTime: number; // Average time to create object in milliseconds
  averageReleaseTime: number; // Average time to release object in milliseconds
  memoryUsageMB: number; // Estimated memory usage in megabytes
}

/**
 * Abstract factory interface for VirtualDollar creation and lifecycle management
 * Provides dependency injection point for different creation strategies
 */
export interface VirtualDollarFactory {
  /**
   * Create a new VirtualDollar instance for the specified player
   * @param playerId - Unique identifier for the player
   * @returns Fully initialized VirtualDollar ready for use
   * @throws Error if playerId is invalid (empty or whitespace)
   */
  create(playerId: string): VirtualDollar;

  /**
   * Release a VirtualDollar instance back to the factory
   * Should be called when the dollar is no longer needed
   * @param dollar - VirtualDollar instance to release
   */
  release(dollar: VirtualDollar): void;

  /**
   * Create multiple VirtualDollar instances in a batch for efficiency
   * @param playerIds - Array of player IDs to create dollars for
   * @returns Array of VirtualDollar instances in same order as input
   */
  createBatch(playerIds: string[]): VirtualDollar[];

  /**
   * Get performance and usage statistics for this factory
   * @returns Current factory statistics including performance metrics
   */
  getStatistics(): FactoryStatistics;

  // ===========================================
  // UNIFIED STATE MANAGEMENT METHODS
  // ===========================================

  /**
   * Get a VirtualDollar by its ID
   * @param dollarId - Unique identifier for the VirtualDollar
   * @returns VirtualDollar instance or null if not found
   */
  getDollar(dollarId: string): VirtualDollar | null;

  /**
   * Update VirtualDollar state with validation and history tracking
   * @param dollarId - ID of the VirtualDollar to update
   * @param newState - New state to transition to
   * @returns Updated VirtualDollar with new state
   * @throws Error if dollarId not found or invalid state transition
   */
  updateDollarState(dollarId: string, newState: DollarState): VirtualDollar;

  /**
   * Get all VirtualDollars belonging to a specific player
   * @param playerId - Player identifier
   * @returns Array of VirtualDollar instances for the player
   */
  getDollarsByPlayer(playerId: string): VirtualDollar[];

  /**
   * Get all VirtualDollars currently in the pool
   * @returns Array of pooled VirtualDollar instances
   */
  getPooledDollars(): VirtualDollar[];

  /**
   * Get VirtualDollar by serial number
   * @param serialNumber - Serial number to search for
   * @returns VirtualDollar instance or null if not found
   */
  getDollarBySerial(serialNumber: string): VirtualDollar | null;

  /**
   * Get VirtualDollar by run ID
   * @param runId - Run identifier to search for
   * @returns VirtualDollar instance or null if not found
   */
  getDollarByRunId(runId: string): VirtualDollar | null;

  /**
   * Get state transition history for a VirtualDollar
   * @param dollarId - ID of the VirtualDollar
   * @returns Array of state transitions
   */
  getDollarStateHistory(dollarId: string): StateTransition[];

  /**
   * Update run data for a VirtualDollar
   * @param dollarId - ID of the VirtualDollar to update
   * @param winnings - Additional winnings to add
   * @returns Updated VirtualDollar
   * @throws Error if dollarId not found
   */
  updateRunData(dollarId: string, winnings: number): VirtualDollar;

  /**
   * Get active runs for a player
   * @param playerId - Player identifier
   * @returns Array of active VirtualDollar instances
   */
  getActiveRunsByPlayer(playerId: string): VirtualDollar[];

  /**
   * Get completed runs for a player
   * @param playerId - Player identifier
   * @returns Array of completed VirtualDollar instances
   */
  getCompletedRunsByPlayer(playerId: string): VirtualDollar[];

  /**
   * Release a VirtualDollar back to the factory for reuse
   * @param dollarId - ID of the VirtualDollar to release
   */
  releaseDollar(dollarId: string): void;

  /**
   * Clean up completed VirtualDollars
   * @returns Number of dollars cleaned up
   */
  cleanupCompletedDollars(): number;

  // ===========================================
  // BUSINESS LOGIC METHODS
  // ===========================================

  /**
   * Advance a player to the next level with winnings calculation
   * Handles level progression, winnings updates, and validation
   * @param dollarId - ID of the VirtualDollar to advance
   * @param newLevel - Target level to advance to (1-10)
   * @param additionalWinnings - Winnings earned from advancing
   * @returns Updated VirtualDollar with new state
   * @throws Error if dollarId not found or invalid level progression
   */
  advancePlayerLevel(
    dollarId: string,
    newLevel: BettingLevel,
    additionalWinnings: number
  ): VirtualDollar;

  /**
   * Mark a player as eliminated and update their state
   * Sets appropriate elimination state and completion data
   * @param dollarId - ID of the VirtualDollar to eliminate
   * @param eliminationLevel - Level at which player was eliminated
   * @returns Updated VirtualDollar with elimination state
   * @throws Error if dollarId not found
   */
  eliminatePlayer(
    dollarId: string,
    eliminationLevel: BettingLevel
  ): VirtualDollar;

  /**
   * Complete a run with specified completion type
   * Handles jackpot, cash-out, and elimination scenarios
   * @param dollarId - ID of the VirtualDollar completing run
   * @param completionType - Type of completion (JACKPOT, CASH_OUT, ELIMINATION)
   * @param finalWinnings - Final winnings amount
   * @returns Updated VirtualDollar with completion state
   * @throws Error if dollarId not found
   */
  completeRun(
    dollarId: string,
    completionType: "JACKPOT" | "CASH_OUT" | "ELIMINATION",
    finalWinnings: number
  ): VirtualDollar;

  // ===========================================
  // P2P-AWARE OPERATIONS
  // ===========================================

  /**
   * Process a peer-to-peer game result with atomic state updates
   * Updates both winner and loser states in a coordinated fashion
   * @param winnerId - ID of the winning VirtualDollar
   * @param loserId - ID of the losing VirtualDollar
   * @param gameResult - Game result data
   * @returns Object containing both updated VirtualDollars
   * @throws Error if either VirtualDollar not found
   */
  processPeerToPeerGame(
    winnerId: string,
    loserId: string,
    gameResult: GameResult
  ): {
    winner: VirtualDollar;
    loser: VirtualDollar;
  };

  /**
   * Update player winnings without changing level
   * Used for intermediate winnings calculations
   * @param dollarId - ID of the VirtualDollar to update
   * @param additionalWinnings - Amount to add to current winnings
   * @returns Updated VirtualDollar with new winnings
   * @throws Error if dollarId not found
   */
  addWinnings(dollarId: string, additionalWinnings: number): VirtualDollar;

  /**
   * Increment games played counter for a player
   * Tracks game participation for statistics
   * @param dollarId - ID of the VirtualDollar to update
   * @returns Updated VirtualDollar with incremented game count
   * @throws Error if dollarId not found
   */
  incrementGamesPlayed(dollarId: string): VirtualDollar;

  // ===========================================
  // VALIDATION AND BUSINESS RULES
  // ===========================================

  /**
   * Check if a player can advance to the next level
   * Validates level progression rules and constraints
   * @param dollarId - ID of the VirtualDollar to check
   * @param targetLevel - Level to advance to
   * @returns True if advancement is valid, false otherwise
   */
  canPlayerAdvance(dollarId: string, targetLevel: BettingLevel): boolean;

  /**
   * Calculate winnings for reaching a specific level
   * Implements exponential progression formula
   * @param level - Betting level to calculate winnings for
   * @returns Winnings amount for the specified level
   */
  calculateLevelWinnings(level: BettingLevel): number;

  /**
   * Get current state of a VirtualDollar by ID
   * Safe getter that doesn't allow direct mutation
   * @param dollarId - ID of the VirtualDollar to retrieve
   * @returns ReadOnly copy of VirtualDollar or null if not found
   */
  getPlayerState(dollarId: string): Readonly<VirtualDollar> | null;
}

/**
 * Game pair interface for batch game session creation
 * Represents the required parameters for creating a GameSession
 */
export interface GamePair {
  dollar1: VirtualDollar;
  dollar2: VirtualDollar;
  level: BettingLevel;
}

/**
 * Abstract factory interface for GameSession creation and lifecycle management
 * Provides dependency injection point for different creation strategies
 */
export interface GameSessionFactory {
  /**
   * Create a new GameSession instance for the specified game parameters
   * @param dollar1 - First virtual dollar participant
   * @param dollar2 - Second virtual dollar participant
   * @param level - Betting level for this game
   * @returns Fully initialized GameSession ready for scoring
   * @throws Error if parameters are invalid
   */
  create(
    dollar1: VirtualDollar,
    dollar2: VirtualDollar,
    level: BettingLevel
  ): GameSession;

  /**
   * Release a GameSession instance back to the factory
   * Should be called when the session is completed and no longer needed
   * @param session - GameSession instance to release
   */
  release(session: GameSession): void;

  /**
   * Create multiple GameSession instances in a batch for efficiency
   * @param pairs - Array of game pairs to create sessions for
   * @returns Array of GameSession instances in same order as input
   */
  createBatch(pairs: GamePair[]): GameSession[];

  /**
   * Get performance and usage statistics for this factory
   * @returns Current factory statistics including performance metrics
   */
  getStatistics(): FactoryStatistics;
}

/**
 * Configuration interface for performance optimization settings
 * Controls factory behavior and object pooling parameters
 */
export interface PerformanceConfig {
  enableObjectPooling: boolean; // Whether to use object pooling for performance
  poolSizes: {
    virtualDollar: number; // Maximum size of VirtualDollar pool
    gameSession: number; // Maximum size of GameSession pool
  };
  prewarmCounts: {
    virtualDollar: number; // Number of VirtualDollars to create on initialization
    gameSession: number; // Number of GameSessions to create on initialization
  };
  enableBatchOptimizations: boolean; // Whether to optimize batch operations
  enablePerformanceMetrics: boolean; // Whether to track detailed performance metrics
}

/**
 * Factory selection utility interface
 * Enables runtime selection of factory implementations based on configuration
 */
export interface FactorySelector {
  /**
   * Select appropriate VirtualDollarFactory based on configuration
   * @param config - Performance configuration settings
   * @returns Configured VirtualDollarFactory instance
   */
  selectVirtualDollarFactory(config: PerformanceConfig): VirtualDollarFactory;

  /**
   * Select appropriate GameSessionFactory based on configuration
   * @param config - Performance configuration settings
   * @returns Configured GameSessionFactory instance
   */
  selectGameSessionFactory(config: PerformanceConfig): GameSessionFactory;
}

/**
 * Default configuration for development and testing environments
 * Provides reasonable defaults for factory configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableObjectPooling: false, // Disabled for development/testing by default
  poolSizes: {
    virtualDollar: 1000,
    gameSession: 1000,
  },
  prewarmCounts: {
    virtualDollar: 10,
    gameSession: 10,
  },
  enableBatchOptimizations: true,
  enablePerformanceMetrics: true,
};

/**
 * Production configuration optimized for performance
 * Enables all optimizations for production workloads
 */
export const PRODUCTION_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableObjectPooling: true, // Enabled for production performance
  poolSizes: {
    virtualDollar: 10000,
    gameSession: 10000,
  },
  prewarmCounts: {
    virtualDollar: 100,
    gameSession: 100,
  },
  enableBatchOptimizations: true,
  enablePerformanceMetrics: true,
};
