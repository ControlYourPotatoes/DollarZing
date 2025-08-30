import { VirtualDollar, GameSession, BettingLevel } from './virtual-dollar-engine';
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
declare class BaseObjectPool<T> implements ObjectPool<T> {
    private pool;
    private createFn;
    private resetFn;
    private maxSize;
    constructor(createFn: () => T, resetFn: (obj: T) => void, maxSize?: number);
    acquire(): T;
    release(obj: T): void;
    size(): number;
    clear(): void;
    /**
     * Pre-warm the pool with initial objects
     */
    prewarm(count: number): void;
}
/**
 * Object pool specifically for VirtualDollar objects
 */
export declare class VirtualDollarPool extends BaseObjectPool<VirtualDollar> {
    constructor(maxSize?: number);
    /**
     * Initialize a pooled VirtualDollar with specific values
     */
    initializeDollar(dollar: VirtualDollar, id: string, serialNumber: string, ownerId: string, runId: string): VirtualDollar;
}
/**
 * Object pool specifically for GameSession objects
 */
export declare class GameSessionPool extends BaseObjectPool<GameSession> {
    private emptyDollar;
    constructor(maxSize?: number);
    /**
     * Initialize a pooled GameSession with specific values
     */
    initializeSession(session: GameSession, id: string, dollar1: VirtualDollar, dollar2: VirtualDollar, level: BettingLevel, gameNumber: number, dailySeed: string): GameSession;
    /**
     * Finalize a GameSession after scoring
     */
    finalizeSession(session: GameSession, winner: VirtualDollar, loser: VirtualDollar, dollar1Score: number, dollar2Score: number, winnings: number): GameSession;
}
/**
 * Object pool manager - Centralized management of all object pools
 */
export declare class ObjectPoolManager {
    private static instance;
    readonly virtualDollarPool: VirtualDollarPool;
    readonly gameSessionPool: GameSessionPool;
    private constructor();
    static getInstance(): ObjectPoolManager;
    /**
     * Get statistics about all pools
     */
    getPoolStatistics(): {
        virtualDollarPool: {
            size: number;
            available: number;
        };
        gameSessionPool: {
            size: number;
            available: number;
        };
    };
    /**
     * Clear all pools - useful for testing and cleanup
     */
    clearAllPools(): void;
    /**
     * Pre-warm all pools with initial objects
     */
    prewarmPools(dollarCount?: number, sessionCount?: number): void;
}
/**
 * Utility function to get the singleton object pool manager
 */
export declare function getObjectPoolManager(): ObjectPoolManager;
/**
 * Check if object pooling is enabled
 */
export declare function isObjectPoolingEnabled(): boolean;
export {};
//# sourceMappingURL=object-pool.d.ts.map