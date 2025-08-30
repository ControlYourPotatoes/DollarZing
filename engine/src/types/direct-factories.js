// Direct Factory Implementations
// Creates objects directly without pooling for development and testing scenarios
// Implements factory interfaces with direct object creation for clean testing
import { DollarState } from './virtual-dollar-engine';
/**
 * Performance tracking utility for timing operations
 */
class PerformanceTracker {
    creationTimes = [];
    releaseTimes = [];
    maxSamples = 100; // Keep last 100 samples for average calculation
    recordCreation(startTime, endTime) {
        const duration = endTime - startTime;
        this.creationTimes.push(duration);
        if (this.creationTimes.length > this.maxSamples) {
            this.creationTimes.shift();
        }
    }
    recordRelease(startTime, endTime) {
        const duration = endTime - startTime;
        this.releaseTimes.push(duration);
        if (this.releaseTimes.length > this.maxSamples) {
            this.releaseTimes.shift();
        }
    }
    getAverageCreationTime() {
        if (this.creationTimes.length === 0)
            return 0;
        return this.creationTimes.reduce((sum, time) => sum + time, 0) / this.creationTimes.length;
    }
    getAverageReleaseTime() {
        if (this.releaseTimes.length === 0)
            return 0;
        return this.releaseTimes.reduce((sum, time) => sum + time, 0) / this.releaseTimes.length;
    }
    reset() {
        this.creationTimes = [];
        this.releaseTimes = [];
    }
}
/**
 * DirectVirtualDollarFactory - Implementation using direct object creation
 * Creates objects directly without pooling, ideal for development and testing
 */
export class DirectVirtualDollarFactory {
    objectsCreated = 0;
    objectsReleased = 0;
    performanceTracker;
    config;
    constructor(config) {
        this.config = config;
        this.performanceTracker = new PerformanceTracker();
    }
    create(playerId) {
        const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
        // Validate player ID
        if (!playerId || playerId.trim() === '') {
            throw new Error('Invalid player ID: cannot be empty or whitespace');
        }
        try {
            // Generate unique identifiers
            const id = this.generateUniqueId();
            const serialNumber = this.generateSerialNumber();
            const runId = this.generateRunId();
            // Create new VirtualDollar directly - matching initializeDollar pattern
            const dollar = {
                id,
                serialNumber,
                currentScore: 0,
                currentLevel: 1,
                state: DollarState.CREATED,
                ownerId: playerId.trim(),
                runId,
                createdAt: new Date(),
                gameHistory: [],
                gamesInThisRun: 0,
                currentRunWinnings: 0,
                isIndependentRun: true
            };
            this.objectsCreated++;
            if (this.config.enablePerformanceMetrics) {
                const endTime = performance.now();
                this.performanceTracker.recordCreation(startTime, endTime);
            }
            return dollar;
        }
        catch (error) {
            throw new Error(`Failed to create virtual dollar: ${error}`);
        }
    }
    release(dollar) {
        const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
        if (!dollar) {
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
    createBatch(playerIds) {
        if (!playerIds || playerIds.length === 0) {
            return [];
        }
        const dollars = [];
        if (this.config.enableBatchOptimizations) {
            // Batch-optimized creation with timing
            const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
            for (const playerId of playerIds) {
                try {
                    const dollar = this.create(playerId);
                    dollars.push(dollar);
                }
                catch (error) {
                    // Continue with other players if one fails
                    console.warn(`Failed to create virtual dollar for player ${playerId}: ${error}`);
                }
            }
            if (this.config.enablePerformanceMetrics && dollars.length > 0) {
                const endTime = performance.now();
                // Record as single batch operation
                this.performanceTracker.recordCreation(startTime, endTime);
            }
        }
        else {
            // Individual creation fallback
            for (const playerId of playerIds) {
                try {
                    const dollar = this.create(playerId);
                    dollars.push(dollar);
                }
                catch (error) {
                    // Continue with other players if one fails
                    console.warn(`Failed to create virtual dollar for player ${playerId}: ${error}`);
                }
            }
        }
        return dollars;
    }
    getStatistics() {
        const objectsInUse = Math.max(0, this.objectsCreated - this.objectsReleased);
        return {
            objectsCreated: this.objectsCreated,
            objectsReleased: this.objectsReleased,
            objectsInUse,
            poolSize: 0, // Direct factory has no pool
            poolHitRate: 0, // No pool means no hits
            averageCreationTime: this.performanceTracker.getAverageCreationTime(),
            averageReleaseTime: this.performanceTracker.getAverageReleaseTime(),
            memoryUsageMB: objectsInUse * 0.001 // Rough estimate: 1KB per object
        };
    }
    /**
     * Reset factory statistics (useful for testing)
     */
    resetStatistics() {
        this.objectsCreated = 0;
        this.objectsReleased = 0;
        this.performanceTracker.reset();
    }
    generateUniqueId() {
        return `vd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateRunId() {
        return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateSerialNumber() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const firstLetter = letters[Math.floor(Math.random() * letters.length)];
        const lastLetter = letters[Math.floor(Math.random() * letters.length)];
        const digits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        return `${firstLetter}${digits}${lastLetter}`;
    }
}
/**
 * DirectGameSessionFactory - Implementation using direct object creation
 * Creates game sessions directly without pooling, ideal for development and testing
 */
export class DirectGameSessionFactory {
    objectsCreated = 0;
    objectsReleased = 0;
    gameCounter = 0;
    performanceTracker;
    config;
    emptyDollar;
    constructor(config) {
        this.config = config;
        this.performanceTracker = new PerformanceTracker();
        // Create empty dollar reference for uninitialized winner/loser
        this.emptyDollar = {
            id: '',
            serialNumber: '',
            currentScore: 0,
            currentLevel: 1,
            state: DollarState.CREATED,
            ownerId: '',
            runId: '',
            createdAt: new Date(),
            gameHistory: [],
            gamesInThisRun: 0,
            currentRunWinnings: 0,
            isIndependentRun: true
        };
    }
    create(dollar1, dollar2, level) {
        const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
        // Validate parameters
        if (!dollar1 || !dollar2) {
            throw new Error('Invalid virtual dollar parameters: both dollars must be provided');
        }
        if (level < 1 || level > 10) {
            throw new Error('Invalid betting level: must be between 1 and 10');
        }
        try {
            this.gameCounter++;
            const id = `game_${this.gameCounter}_${Date.now()}`;
            const dailySeed = ''; // Will be set during game resolution
            // Create new GameSession directly - matching initializeSession pattern
            const session = {
                id,
                dollar1,
                dollar2,
                winner: this.emptyDollar, // Will be set during game resolution
                loser: this.emptyDollar, // Will be set during game resolution
                level,
                platformFee: 0.20, // Standard 20c platform fee
                timestamp: new Date(),
                gameNumber: this.gameCounter,
                dailySeed: this.getCurrentDailySeed(),
                dollar1Score: 0, // Will be set during scoring
                dollar2Score: 0, // Will be set during scoring
                winnings: this.calculateWinnings(level),
                isCompleted: false, // New games start as incomplete
                duration: 0, // No duration until game is completed
                randomSeed: this.generateDeterministicSeed(id)
            };
            this.objectsCreated++;
            if (this.config.enablePerformanceMetrics) {
                const endTime = performance.now();
                this.performanceTracker.recordCreation(startTime, endTime);
            }
            return session;
        }
        catch (error) {
            throw new Error(`Failed to create game session: ${error}`);
        }
    }
    release(session) {
        const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
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
    createBatch(pairs) {
        if (!pairs || pairs.length === 0) {
            return [];
        }
        const sessions = [];
        if (this.config.enableBatchOptimizations) {
            // Batch-optimized creation with timing
            const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
            for (const pair of pairs) {
                try {
                    const session = this.create(pair.dollar1, pair.dollar2, pair.level);
                    sessions.push(session);
                }
                catch (error) {
                    // Continue with other pairs if one fails
                    console.warn(`Failed to create game session: ${error}`);
                }
            }
            if (this.config.enablePerformanceMetrics && sessions.length > 0) {
                const endTime = performance.now();
                // Record as single batch operation
                this.performanceTracker.recordCreation(startTime, endTime);
            }
        }
        else {
            // Individual creation fallback
            for (const pair of pairs) {
                try {
                    const session = this.create(pair.dollar1, pair.dollar2, pair.level);
                    sessions.push(session);
                }
                catch (error) {
                    // Continue with other pairs if one fails
                    console.warn(`Failed to create game session: ${error}`);
                }
            }
        }
        return sessions;
    }
    getStatistics() {
        const objectsInUse = Math.max(0, this.objectsCreated - this.objectsReleased);
        return {
            objectsCreated: this.objectsCreated,
            objectsReleased: this.objectsReleased,
            objectsInUse,
            poolSize: 0, // Direct factory has no pool
            poolHitRate: 0, // No pool means no hits
            averageCreationTime: this.performanceTracker.getAverageCreationTime(),
            averageReleaseTime: this.performanceTracker.getAverageReleaseTime(),
            memoryUsageMB: objectsInUse * 0.002 // Rough estimate: 2KB per session
        };
    }
    /**
     * Reset factory statistics (useful for testing)
     */
    resetStatistics() {
        this.objectsCreated = 0;
        this.objectsReleased = 0;
        this.gameCounter = 0;
        this.performanceTracker.reset();
    }
    calculateWinnings(level) {
        // Simple exponential calculation: 2^(level-1)
        return Math.pow(2, level - 1);
    }
    /**
     * Generate current daily seed in YYYY-MM-DD format
     */
    getCurrentDailySeed() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * Generate deterministic random seed from game ID
     */
    generateDeterministicSeed(gameId) {
        // Simple hash function to convert string to number between 0 and 1
        let hash = 0;
        for (let i = 0; i < gameId.length; i++) {
            const char = gameId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        // Normalize to 0-1 range
        return Math.abs(hash) / Math.pow(2, 31);
    }
}
//# sourceMappingURL=direct-factories.js.map