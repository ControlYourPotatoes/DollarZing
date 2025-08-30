import { VirtualDollar, VirtualDollarManager } from './virtual-dollar-types';
import { ScoringEngine } from './scoring-engine';
import { GameSession, BettingLevel, PlayerBalanceManager } from './virtual-dollar-engine';
import { GameSessionFactory } from './factory-interfaces';
export type GameEventType = 'gameCreated' | 'gameResolved' | 'poolUpdated' | 'matchingAttempted';
export interface GameEvent {
    type: GameEventType;
    gameId?: string;
    timestamp: Date;
    level?: BettingLevel;
    winnerId?: string;
    loserId?: string;
    winnings?: number;
    poolSize?: number;
}
export interface GameMatchResult {
    matchesMade: number;
    gamesCreated: GameSession[];
    dollarsMatched: string[];
    timestamp: Date;
}
export interface GameResolutionResult {
    success: boolean;
    gameId: string;
    winner?: VirtualDollar;
    loser?: VirtualDollar;
    winnings: number;
    error?: string;
}
export interface PoolOperationResult {
    success: boolean;
    error?: string;
}
export interface PoolStatistics {
    totalDollarsInPool: number;
    availableForMatching: number;
    dollarsInGame: number;
    dollarsByLevel?: Record<BettingLevel, number>;
    totalGamesCompleted: number;
}
export interface GameStatistics {
    totalGamesPlayed: number;
    gamesByLevel?: Record<BettingLevel, number>;
    totalPlatformFees: number;
    totalWinnings: number;
    averageGameDuration?: number;
}
export interface AuditTrail {
    totalGames: number;
    gameHistory: GameSession[];
    lastUpdated: Date;
}
type EventListener = (event: GameEvent) => void;
/**
 * GameMatchingEngine - Core class for managing 1v1 game matching and resolution
 * Handles virtual dollar pool management, automatic matching, and game lifecycle
 */
export declare class GameMatchingEngine {
    private dollarManager;
    private scoringEngine;
    private gameSessionFactory;
    private playerBalanceManager?;
    private pooledDollars;
    private dollarsByLevel;
    private dollarsInGame;
    private activeGames;
    private completedGames;
    private gameCounter;
    private eventListeners;
    private maxConcurrentGames;
    constructor(dollarManager: VirtualDollarManager, scoringEngine: ScoringEngine, gameSessionFactory: GameSessionFactory);
    /**
     * Add virtual dollar to matching pool
     */
    addToPool(dollar: VirtualDollar): PoolOperationResult;
    /**
     * Remove virtual dollar from matching pool
     */
    removeFromPool(dollarId: string): PoolOperationResult;
    /**
     * Attempt to match available dollars and create games
     */
    attemptMatching(): GameMatchResult;
    /**
     * Create a new game session using injected factory
     */
    private createGameSession;
    /**
     * Resolve a game using scoring engine and update states
     */
    resolveGame(gameId: string, dailySeed: string): GameResolutionResult;
    /**
     * Get game session by ID
     */
    getGameSession(gameId: string): GameSession | null;
    /**
     * Get pool statistics
     */
    getPoolStatistics(): PoolStatistics;
    /**
     * Get comprehensive game statistics
     */
    getStatistics(): GameStatistics;
    /**
     * Get audit trail of all games
     */
    getAuditTrail(): AuditTrail;
    /**
     * Get games by player ID
     */
    getGamesByPlayer(playerId: string): GameSession[];
    /**
     * Get games by betting level
     */
    getGamesByLevel(level: BettingLevel): GameSession[];
    /**
     * Set maximum concurrent games
     */
    setMaxConcurrentGames(max: number): void;
    /**
     * Set PlayerBalanceManager for balance validation
     */
    setPlayerBalanceManager(balanceManager: PlayerBalanceManager): void;
    /**
     * Event system - add listener
     */
    on(eventType: GameEventType, listener: EventListener): void;
    /**
     * Event system - remove listener
     */
    off(eventType: GameEventType, listener: EventListener): void;
    /**
     * Event system - emit event
     */
    private emit;
    /**
     * Clear all completed games (for memory management)
     */
    clearCompletedGames(): void;
    /**
     * Get active game count
     */
    getActiveGameCount(): number;
    /**
     * Get factory statistics for performance monitoring
     */
    getFactoryStatistics(): import("./factory-interfaces").FactoryStatistics;
}
export {};
//# sourceMappingURL=game-matching-engine.d.ts.map