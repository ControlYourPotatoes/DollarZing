import { VirtualDollar, GameSession, BettingLevel } from './virtual-dollar-engine';
/**
 * Statistics interface for factory performance monitoring
 * Tracks object creation, pooling efficiency, and performance metrics
 */
export interface FactoryStatistics {
    objectsCreated: number;
    objectsReleased: number;
    objectsInUse: number;
    poolSize: number;
    poolHitRate: number;
    averageCreationTime: number;
    averageReleaseTime: number;
    memoryUsageMB: number;
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
    create(dollar1: VirtualDollar, dollar2: VirtualDollar, level: BettingLevel): GameSession;
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
    enableObjectPooling: boolean;
    poolSizes: {
        virtualDollar: number;
        gameSession: number;
    };
    prewarmCounts: {
        virtualDollar: number;
        gameSession: number;
    };
    enableBatchOptimizations: boolean;
    enablePerformanceMetrics: boolean;
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
export declare const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig;
/**
 * Production configuration optimized for performance
 * Enables all optimizations for production workloads
 */
export declare const PRODUCTION_PERFORMANCE_CONFIG: PerformanceConfig;
//# sourceMappingURL=factory-interfaces.d.ts.map