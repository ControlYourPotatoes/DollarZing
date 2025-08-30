import { GameSession, BettingLevel } from './virtual-dollar-engine';
import { VirtualDollar } from './virtual-dollar-types';
/**
 * Interface for cacheable statistics
 */
export interface CacheableStatistics {
    lastUpdated: Date;
    dataVersion: number;
    isValid: boolean;
}
/**
 * Complex game statistics with expensive calculations
 */
export interface ComplexGameStatistics extends CacheableStatistics {
    totalGamesPlayed: number;
    gamesByLevel: Record<BettingLevel, number>;
    totalPlatformFees: number;
    totalWinnings: number;
    averageGameDuration: number;
    winRateByLevel: Record<BettingLevel, number>;
    averageWinningsPerLevel: Record<BettingLevel, number>;
    playerDistributionByLevel: Record<BettingLevel, number>;
    levelPopularityRankings: {
        level: BettingLevel;
        gamesPlayed: number;
        avgWinnings: number;
    }[];
    timeSeriesData: {
        timestamp: Date;
        gamesPerHour: number;
        totalWinnings: number;
    }[];
}
/**
 * Complex player statistics with expensive calculations
 */
export interface ComplexPlayerStatistics extends CacheableStatistics {
    totalPlayers: number;
    activePlayers: number;
    retiredPlayers: number;
    averageGamesPerPlayer: number;
    winRateDistribution: {
        range: string;
        count: number;
    }[];
    lifetimeValueDistribution: {
        range: string;
        count: number;
        avgValue: number;
    }[];
    playerRetentionRates: {
        timeframe: string;
        retentionRate: number;
    }[];
    topPerformers: {
        playerId: string;
        totalWinnings: number;
        gamesWon: number;
        winRate: number;
    }[];
}
/**
 * Lazy statistics manager for expensive calculations
 * Uses caching and dirty flags to minimize computation overhead
 */
export declare class LazyStatisticsManager {
    private gameStatistics;
    private playerStatistics;
    private dataVersion;
    private gameDataDirty;
    private playerDataDirty;
    private cacheExpirationMs;
    private enableCaching;
    private calculationTimes;
    constructor(enableCaching?: boolean, cacheExpirationMs?: number);
    /**
     * Invalidate caches when data changes
     * Should be called whenever games are completed or players are updated
     */
    invalidateCache(dataType?: 'games' | 'players' | 'all'): void;
    /**
     * Get complex game statistics with lazy evaluation
     */
    getComplexGameStatistics(games: Map<string, GameSession>): ComplexGameStatistics;
    /**
     * Get complex player statistics with lazy evaluation
     */
    getComplexPlayerStatistics(players: VirtualDollar[]): ComplexPlayerStatistics;
    /**
     * Calculate complex game statistics (expensive operation)
     */
    private calculateComplexGameStatistics;
    /**
     * Calculate complex player statistics (expensive operation)
     */
    private calculateComplexPlayerStatistics;
    /**
     * Calculate time series data for games
     */
    private calculateTimeSeriesData;
    /**
     * Calculate distribution of values into ranges
     */
    private calculateDistribution;
    /**
     * Calculate value distribution for lifetime values
     */
    private calculateValueDistribution;
    /**
     * Check if cache is still valid
     */
    private isCacheValid;
    /**
     * Record calculation time for performance monitoring
     */
    private recordCalculationTime;
    /**
     * Get performance statistics for lazy evaluation system
     */
    getPerformanceStatistics(): {
        operationStats: Record<string, {
            averageTime: number;
            totalCalls: number;
            cacheHitRate?: number;
        }>;
        cacheEnabled: boolean;
        cacheExpirationMs: number;
        dataVersion: number;
        gameStatsCached: boolean;
        playerStatsCached: boolean;
    };
    /**
     * Clear all cached data and reset performance counters
     */
    clearCache(): void;
    /**
     * Configure cache settings
     */
    configureCaching(enabled: boolean, expirationMs?: number): void;
}
//# sourceMappingURL=lazy-statistics.d.ts.map