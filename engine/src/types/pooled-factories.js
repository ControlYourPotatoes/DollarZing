// Pooled Factory Implementations
// Utilizes existing object pool infrastructure for performance optimization
// Implements factory interfaces with object pooling for memory efficiency
import { getObjectPoolManager, isObjectPoolingEnabled } from './object-pool';
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
 * PooledVirtualDollarFactory - Implementation using object pooling for performance
 * Utilizes the existing VirtualDollarPool for memory-efficient object management
 */
export class PooledVirtualDollarFactory {
    objectsCreated = 0;
    objectsReleased = 0;
    performanceTracker;
    config;
    constructor(config) {
        this.config = config;
        this.performanceTracker = new PerformanceTracker();
        // Pre-warm pool if configured
        if (config.prewarmCounts.virtualDollar > 0 && isObjectPoolingEnabled()) {
            const poolManager = getObjectPoolManager();
            poolManager.virtualDollarPool.prewarm(config.prewarmCounts.virtualDollar);
        }
    }
    create(playerId) {
        const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
        // Validate player ID
        if (!playerId || playerId.trim() === '') {
            throw new Error('Invalid player ID: cannot be empty or whitespace');
        }
        if (!isObjectPoolingEnabled()) {
            throw new Error('Object pooling is not enabled. Use DirectVirtualDollarFactory instead.');
        }
        try {
            const poolManager = getObjectPoolManager();
            const dollar = poolManager.virtualDollarPool.acquire();
            // Generate unique identifiers
            const id = this.generateUniqueId();
            const serialNumber = this.generateSerialNumber();
            const runId = this.generateRunId();
            // Initialize the pooled object
            poolManager.virtualDollarPool.initializeDollar(dollar, id, serialNumber, playerId, runId);
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
        if (!isObjectPoolingEnabled()) {
            return; // Nothing to do if pooling is disabled
        }
        try {
            const poolManager = getObjectPoolManager();
            poolManager.virtualDollarPool.release(dollar);
            this.objectsReleased++;
            if (this.config.enablePerformanceMetrics) {
                const endTime = performance.now();
                this.performanceTracker.recordRelease(startTime, endTime);
            }
        }
        catch (error) {
            console.warn(`Warning: Failed to release virtual dollar to pool: ${error}`);
            // Don't throw - release operations should be non-critical
        }
    }
    createBatch(playerIds) {
        if (!playerIds || playerIds.length === 0) {
            return [];
        }
        const dollars = [];
        if (this.config.enableBatchOptimizations) {
            // Batch-optimized creation
            const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
            try {
                for (const playerId of playerIds) {
                    const dollar = this.create(playerId);
                    dollars.push(dollar);
                }
                if (this.config.enablePerformanceMetrics) {
                    const endTime = performance.now();
                    // Record as single batch operation
                    this.performanceTracker.recordCreation(startTime, endTime);
                }
            }
            catch (error) {
                // If batch fails, release any created objects
                dollars.forEach(dollar => this.release(dollar));
                throw error;
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
        const poolManager = isObjectPoolingEnabled() ? getObjectPoolManager() : null;
        const poolSize = poolManager ? poolManager.virtualDollarPool.size() : 0;
        const objectsInUse = Math.max(0, this.objectsCreated - this.objectsReleased);
        // Calculate pool hit rate
        const poolHitRate = this.objectsCreated > 0 && poolSize > 0
            ? Math.min(poolSize / this.objectsCreated, 1.0)
            : 0;
        return {
            objectsCreated: this.objectsCreated,
            objectsReleased: this.objectsReleased,
            objectsInUse,
            poolSize,
            poolHitRate,
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
 * PooledGameSessionFactory - Implementation using object pooling for performance
 * Utilizes the existing GameSessionPool for memory-efficient object management
 */
export class PooledGameSessionFactory {
    objectsCreated = 0;
    objectsReleased = 0;
    gameCounter = 0;
    performanceTracker;
    config;
    constructor(config) {
        this.config = config;
        this.performanceTracker = new PerformanceTracker();
        // Pre-warm pool if configured
        if (config.prewarmCounts.gameSession > 0 && isObjectPoolingEnabled()) {
            const poolManager = getObjectPoolManager();
            poolManager.gameSessionPool.prewarm(config.prewarmCounts.gameSession);
        }
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
        if (!isObjectPoolingEnabled()) {
            throw new Error('Object pooling is not enabled. Use DirectGameSessionFactory instead.');
        }
        try {
            const poolManager = getObjectPoolManager();
            const session = poolManager.gameSessionPool.acquire();
            this.gameCounter++;
            const id = `game_${this.gameCounter}_${Date.now()}`;
            const dailySeed = ''; // Will be set during game resolution
            // Initialize the pooled session
            poolManager.gameSessionPool.initializeSession(session, id, dollar1, dollar2, level, this.gameCounter, dailySeed);
            // Set winnings based on level
            session.winnings = this.calculateWinnings(level);
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
        if (!isObjectPoolingEnabled()) {
            return; // Nothing to do if pooling is disabled
        }
        try {
            const poolManager = getObjectPoolManager();
            poolManager.gameSessionPool.release(session);
            this.objectsReleased++;
            if (this.config.enablePerformanceMetrics) {
                const endTime = performance.now();
                this.performanceTracker.recordRelease(startTime, endTime);
            }
        }
        catch (error) {
            console.warn(`Warning: Failed to release game session to pool: ${error}`);
            // Don't throw - release operations should be non-critical
        }
    }
    createBatch(pairs) {
        if (!pairs || pairs.length === 0) {
            return [];
        }
        const sessions = [];
        if (this.config.enableBatchOptimizations) {
            // Batch-optimized creation
            const startTime = this.config.enablePerformanceMetrics ? performance.now() : 0;
            try {
                for (const pair of pairs) {
                    const session = this.create(pair.dollar1, pair.dollar2, pair.level);
                    sessions.push(session);
                }
                if (this.config.enablePerformanceMetrics) {
                    const endTime = performance.now();
                    // Record as single batch operation
                    this.performanceTracker.recordCreation(startTime, endTime);
                }
            }
            catch (error) {
                // If batch fails, release any created sessions
                sessions.forEach(session => this.release(session));
                throw error;
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
        const poolManager = isObjectPoolingEnabled() ? getObjectPoolManager() : null;
        const poolSize = poolManager ? poolManager.gameSessionPool.size() : 0;
        const objectsInUse = Math.max(0, this.objectsCreated - this.objectsReleased);
        // Calculate pool hit rate
        const poolHitRate = this.objectsCreated > 0 && poolSize > 0
            ? Math.min(poolSize / this.objectsCreated, 1.0)
            : 0;
        return {
            objectsCreated: this.objectsCreated,
            objectsReleased: this.objectsReleased,
            objectsInUse,
            poolSize,
            poolHitRate,
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
}
//# sourceMappingURL=pooled-factories.js.map