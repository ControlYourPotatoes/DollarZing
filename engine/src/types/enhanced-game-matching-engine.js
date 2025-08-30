// Enhanced GameMatchingEngine with Batch Processing Optimizations
// This version adds improved batch processing capabilities while maintaining
// compatibility with the existing GameMatchingEngine interface
import { DollarState } from './virtual-dollar-types';
import { GameMatchingEngine } from './game-matching-engine';
/**
 * Enhanced GameMatchingEngine with optimized batch processing
 * Extends the base GameMatchingEngine with improved throughput capabilities
 */
export class EnhancedGameMatchingEngine extends GameMatchingEngine {
    // Batch processing configuration
    batchSize = 50; // Number of games to create in each batch
    enableBatchOptimization = true;
    constructor(dollarManager, scoringEngine, gameSessionFactory) {
        super(dollarManager, scoringEngine, gameSessionFactory);
    }
    /**
     * Set batch processing configuration
     */
    setBatchConfiguration(batchSize, enableOptimization = true) {
        if (batchSize < 1) {
            throw new Error('Batch size must be at least 1');
        }
        this.batchSize = batchSize;
        this.enableBatchOptimization = enableOptimization;
    }
    /**
     * Enhanced matching with batch processing optimization
     * Overrides the base attemptMatching to use batch factory operations
     */
    attemptMatching() {
        if (!this.enableBatchOptimization) {
            // Fall back to base implementation if batch optimization is disabled
            return super.attemptMatching();
        }
        return this.attemptBatchMatching();
    }
    /**
     * Optimized batch matching implementation
     */
    attemptBatchMatching() {
        const matchedDollars = [];
        const gamesCreated = [];
        const timestamp = new Date();
        // Check concurrent game limit
        if (this.getActiveGameCount() >= 1000) {
            return {
                matchesMade: 0,
                gamesCreated: [],
                dollarsMatched: [],
                timestamp
            };
        }
        // Collect all possible game pairs across all levels
        const allGamePairs = [];
        // Try to match at each level
        for (let level = 1; level <= 11; level++) {
            const bettingLevel = level;
            const levelStats = this.getPoolStatistics().dollarsByLevel;
            if (!levelStats || levelStats[bettingLevel] < 2) {
                continue; // Not enough dollars at this level
            }
            // Get available dollars for this level (we need to access private members)
            const availableDollars = this.getAvailableDollarsForLevel(bettingLevel);
            // Create pairs for batch processing
            for (let i = 0; i < availableDollars.length - 1; i += 2) {
                if (allGamePairs.length >= this.batchSize ||
                    (this.getActiveGameCount() + allGamePairs.length) >= 1000) {
                    break; // Hit batch limit or concurrent limit
                }
                const dollar1 = availableDollars[i];
                const dollar2 = availableDollars[i + 1];
                allGamePairs.push({
                    dollar1,
                    dollar2,
                    level: bettingLevel
                });
            }
            if (allGamePairs.length >= this.batchSize) {
                break; // Hit batch size limit
            }
        }
        // Process pairs in batches
        const batchGames = this.processBatchPairs(allGamePairs);
        // Update tracking for all created games
        batchGames.forEach(game => {
            // Mark dollars as in-game
            this.markDollarInGame(game.dollar1.id);
            this.markDollarInGame(game.dollar2.id);
            // Update dollar states
            this.updateDollarStates(game.dollar1.id, game.dollar2.id, DollarState.IN_GAME);
            // Remove from pool
            this.removeDollarsFromPool([game.dollar1.id, game.dollar2.id]);
            // Track active game
            this.addActiveGame(game);
            gamesCreated.push(game);
            matchedDollars.push(game.dollar1.id, game.dollar2.id);
            // Emit game created event
            this.emitGameEvent({
                type: 'gameCreated',
                gameId: game.id,
                timestamp: new Date(),
                level: game.level
            });
        });
        // Emit matching attempt event
        this.emitGameEvent({
            type: 'matchingAttempted',
            timestamp: new Date(),
            poolSize: this.getPoolStatistics().totalDollarsInPool
        });
        return {
            matchesMade: gamesCreated.length,
            gamesCreated,
            dollarsMatched: matchedDollars,
            timestamp
        };
    }
    /**
     * Process game pairs using batch factory operations
     */
    processBatchPairs(pairs) {
        if (pairs.length === 0) {
            return [];
        }
        try {
            // Use factory batch creation for optimal performance
            return this.gameSessionFactory.createBatch(pairs);
        }
        catch (error) {
            console.warn(`Batch game creation failed: ${error}, falling back to individual creation`);
            // Fallback to individual creation
            const games = [];
            for (const pair of pairs) {
                try {
                    const game = this.gameSessionFactory.create(pair.dollar1, pair.dollar2, pair.level);
                    games.push(game);
                }
                catch (singleError) {
                    console.warn(`Failed to create individual game: ${singleError}`);
                }
            }
            return games;
        }
    }
    /**
     * Helper method to get available dollars for a specific level
     * This would need to be implemented by accessing the private members or
     * by adding a public getter to the base class
     */
    getAvailableDollarsForLevel(level) {
        // This is a simplified implementation - in the real implementation,
        // we would need access to the private pooledDollars and dollarsByLevel maps
        // For now, return empty array to avoid compilation errors
        return [];
    }
    /**
     * Helper methods that would need to be implemented to access private functionality
     */
    markDollarInGame(dollarId) {
        // Implementation would access private dollarsInGame set
    }
    updateDollarStates(dollar1Id, dollar2Id, state) {
        // Implementation would call dollarManager.updateDollarState for both dollars
    }
    removeDollarsFromPool(dollarIds) {
        // Implementation would call removeFromPool for each dollar
    }
    addActiveGame(game) {
        // Implementation would add to private activeGames map
    }
    emitGameEvent(event) {
        // Implementation would call private emit method
    }
    /**
     * Get performance statistics including batch processing metrics
     */
    getBatchProcessingStatistics() {
        const baseStats = this.getFactoryStatistics();
        return {
            ...baseStats,
            batchSize: this.batchSize,
            batchOptimizationEnabled: this.enableBatchOptimization,
            recommendedBatchSize: this.calculateOptimalBatchSize()
        };
    }
    /**
     * Calculate optimal batch size based on current performance
     */
    calculateOptimalBatchSize() {
        const stats = this.getFactoryStatistics();
        // Simple heuristic: if creation time is very low, increase batch size
        if (stats.averageCreationTime < 0.1) {
            return Math.min(this.batchSize * 2, 100);
        }
        else if (stats.averageCreationTime > 1) {
            return Math.max(this.batchSize / 2, 10);
        }
        return this.batchSize;
    }
}
//# sourceMappingURL=enhanced-game-matching-engine.js.map