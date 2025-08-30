import { VirtualDollarManager } from './virtual-dollar-types';
import { ScoringEngine } from './scoring-engine';
import { GameSessionFactory } from './factory-interfaces';
import { GameMatchingEngine, GameMatchResult } from './game-matching-engine';
/**
 * Enhanced GameMatchingEngine with optimized batch processing
 * Extends the base GameMatchingEngine with improved throughput capabilities
 */
export declare class EnhancedGameMatchingEngine extends GameMatchingEngine {
    private batchSize;
    private enableBatchOptimization;
    constructor(dollarManager: VirtualDollarManager, scoringEngine: ScoringEngine, gameSessionFactory: GameSessionFactory);
    /**
     * Set batch processing configuration
     */
    setBatchConfiguration(batchSize: number, enableOptimization?: boolean): void;
    /**
     * Enhanced matching with batch processing optimization
     * Overrides the base attemptMatching to use batch factory operations
     */
    attemptMatching(): GameMatchResult;
    /**
     * Optimized batch matching implementation
     */
    private attemptBatchMatching;
    /**
     * Process game pairs using batch factory operations
     */
    private processBatchPairs;
    /**
     * Helper method to get available dollars for a specific level
     * This would need to be implemented by accessing the private members or
     * by adding a public getter to the base class
     */
    private getAvailableDollarsForLevel;
    /**
     * Helper methods that would need to be implemented to access private functionality
     */
    private markDollarInGame;
    private updateDollarStates;
    private removeDollarsFromPool;
    private addActiveGame;
    private emitGameEvent;
    /**
     * Get performance statistics including batch processing metrics
     */
    getBatchProcessingStatistics(): {
        batchSize: number;
        batchOptimizationEnabled: boolean;
        recommendedBatchSize: number;
        objectsCreated: number;
        objectsReleased: number;
        objectsInUse: number;
        poolSize: number;
        poolHitRate: number;
        averageCreationTime: number;
        averageReleaseTime: number;
        memoryUsageMB: number;
    };
    /**
     * Calculate optimal batch size based on current performance
     */
    private calculateOptimalBatchSize;
}
export { EnhancedGameMatchingEngine };
//# sourceMappingURL=enhanced-game-matching-engine.d.ts.map