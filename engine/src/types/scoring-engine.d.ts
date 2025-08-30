import { ValidationResult } from './virtual-dollar-engine';
export interface ScoreResult {
    winner: string;
    loser: string;
    winnerScore: number;
    loserScore: number;
}
/**
 * ScoringEngine - Deterministic scoring system for virtual dollars
 * Uses serial number + daily seed for consistent, repeatable score generation
 */
export declare class ScoringEngine {
    private scoreCache;
    /**
     * Simple deterministic hash function for consistent scoring
     * Uses a combination of string hashing and mathematical operations
     */
    private hashString;
    /**
     * Generate a normalized score (0-1) from hash value
     */
    private normalizeScore;
    /**
     * Validate serial number format (letter + 8 digits + letter)
     */
    private validateSerialNumber;
    /**
     * Validate daily seed format (YYYY-MM-DD)
     */
    private validateDailySeed;
    /**
     * Generate cache key for memoization
     */
    private getCacheKey;
    /**
     * Calculate deterministic score for a serial number + daily seed combination
     * Returns a normalized score between 0 and 1
     */
    calculateScore(serialNumber: string, dailySeed: string): number;
    /**
     * Compare two serial numbers and determine winner/loser for game resolution
     */
    compareScores(serial1: string, serial2: string, dailySeed: string): ScoreResult;
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats(): {
        size: number;
        hitRate?: number;
    };
    /**
     * Clear the score cache (useful for testing or memory management)
     */
    clearCache(): void;
    /**
     * Batch calculate scores for multiple serial numbers (performance optimization)
     */
    calculateBatchScores(serialNumbers: string[], dailySeed: string): Map<string, number>;
}
export { ValidationResult };
//# sourceMappingURL=scoring-engine.d.ts.map