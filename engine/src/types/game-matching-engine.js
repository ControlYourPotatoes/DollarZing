// GameMatchingEngine Implementation
// Handles virtual dollar pool management, 1v1 matching, and game resolution
// Provides event-driven architecture for game tracking and analytics
import { DollarState } from './virtual-dollar-types';
/**
 * GameMatchingEngine - Core class for managing 1v1 game matching and resolution
 * Handles virtual dollar pool management, automatic matching, and game lifecycle
 */
export class GameMatchingEngine {
    dollarManager;
    scoringEngine;
    gameSessionFactory;
    playerBalanceManager;
    // Pool management
    pooledDollars = new Map();
    dollarsByLevel = new Map();
    dollarsInGame = new Set();
    // Game management
    activeGames = new Map();
    completedGames = new Map();
    gameCounter = 0;
    // Event system
    eventListeners = new Map();
    // Configuration
    maxConcurrentGames = 1000;
    constructor(dollarManager, scoringEngine, gameSessionFactory) {
        this.dollarManager = dollarManager;
        this.scoringEngine = scoringEngine;
        this.gameSessionFactory = gameSessionFactory;
        // Initialize level pools
        for (let level = 1; level <= 11; level++) {
            this.dollarsByLevel.set(level, new Set());
        }
        // Initialize event listener maps
        const eventTypes = ['gameCreated', 'gameResolved', 'poolUpdated', 'matchingAttempted'];
        eventTypes.forEach(type => {
            this.eventListeners.set(type, []);
        });
    }
    /**
     * Add virtual dollar to matching pool
     */
    addToPool(dollar) {
        // Validate dollar state
        if (dollar.state !== DollarState.POOLED) {
            return {
                success: false,
                error: 'Only POOLED dollars can be added to matching pool'
            };
        }
        // Check for duplicates
        if (this.pooledDollars.has(dollar.id)) {
            return {
                success: false,
                error: 'Dollar already in pool'
            };
        }
        // Validate player balance if balance manager is available
        if (this.playerBalanceManager && !this.playerBalanceManager.canPlayerPlay(dollar.ownerId)) {
            return {
                success: false,
                error: 'Player does not have sufficient balance to play games'
            };
        }
        // Add to pool
        this.pooledDollars.set(dollar.id, dollar);
        // Add to level-specific pool
        const levelSet = this.dollarsByLevel.get(dollar.currentLevel);
        if (levelSet) {
            levelSet.add(dollar.id);
        }
        // Emit pool update event
        this.emit('poolUpdated', {
            type: 'poolUpdated',
            timestamp: new Date(),
            poolSize: this.pooledDollars.size
        });
        return { success: true };
    }
    /**
     * Remove virtual dollar from matching pool
     */
    removeFromPool(dollarId) {
        const dollar = this.pooledDollars.get(dollarId);
        if (!dollar) {
            return {
                success: false,
                error: 'Dollar not found in pool'
            };
        }
        // Remove from main pool
        this.pooledDollars.delete(dollarId);
        // Remove from level-specific pool
        const levelSet = this.dollarsByLevel.get(dollar.currentLevel);
        if (levelSet) {
            levelSet.delete(dollarId);
        }
        // Emit pool update event
        this.emit('poolUpdated', {
            type: 'poolUpdated',
            timestamp: new Date(),
            poolSize: this.pooledDollars.size
        });
        return { success: true };
    }
    /**
     * Attempt to match available dollars and create games
     */
    attemptMatching() {
        const matchedDollars = [];
        const gamesCreated = [];
        const timestamp = new Date();
        // Check concurrent game limit
        if (this.activeGames.size >= this.maxConcurrentGames) {
            return {
                matchesMade: 0,
                gamesCreated: [],
                dollarsMatched: [],
                timestamp
            };
        }
        // Try to match at each level
        for (let level = 1; level <= 11; level++) {
            const bettingLevel = level;
            const levelDollars = this.dollarsByLevel.get(bettingLevel);
            if (!levelDollars || levelDollars.size < 2) {
                continue; // Not enough dollars at this level
            }
            // Convert to array and sort by creation time (FIFO)
            const availableDollars = Array.from(levelDollars)
                .map(id => this.pooledDollars.get(id))
                .filter(dollar => dollar && !this.dollarsInGame.has(dollar.id))
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            // Match pairs
            for (let i = 0; i < availableDollars.length - 1; i += 2) {
                if (this.activeGames.size >= this.maxConcurrentGames) {
                    break; // Hit concurrent limit
                }
                const dollar1 = availableDollars[i];
                const dollar2 = availableDollars[i + 1];
                // Create game session
                const game = this.createGameSession(dollar1, dollar2, bettingLevel);
                // Mark dollars as in-game
                this.dollarsInGame.add(dollar1.id);
                this.dollarsInGame.add(dollar2.id);
                // Update dollar states
                this.dollarManager.updateDollarState(dollar1.id, DollarState.IN_GAME);
                this.dollarManager.updateDollarState(dollar2.id, DollarState.IN_GAME);
                // Remove from pool
                this.removeFromPool(dollar1.id);
                this.removeFromPool(dollar2.id);
                // Track active game
                this.activeGames.set(game.id, game);
                gamesCreated.push(game);
                matchedDollars.push(dollar1.id, dollar2.id);
                // Emit game created event
                this.emit('gameCreated', {
                    type: 'gameCreated',
                    gameId: game.id,
                    timestamp: new Date(),
                    level: bettingLevel
                });
            }
        }
        // Emit matching attempt event
        this.emit('matchingAttempted', {
            type: 'matchingAttempted',
            timestamp: new Date(),
            poolSize: this.pooledDollars.size
        });
        return {
            matchesMade: gamesCreated.length,
            gamesCreated,
            dollarsMatched: matchedDollars,
            timestamp
        };
    }
    /**
     * Create a new game session using injected factory
     */
    createGameSession(dollar1, dollar2, level) {
        try {
            return this.gameSessionFactory.create(dollar1, dollar2, level);
        }
        catch (error) {
            throw new Error(`Failed to create game session through factory: ${error}`);
        }
    }
    /**
     * Resolve a game using scoring engine and update states
     */
    resolveGame(gameId, dailySeed) {
        const game = this.activeGames.get(gameId);
        if (!game) {
            return {
                success: false,
                gameId,
                winnings: 0,
                error: 'Game not found or already resolved'
            };
        }
        try {
            // Get scores from scoring engine
            const scoreResult = this.scoringEngine.compareScores(game.dollar1.serialNumber, game.dollar2.serialNumber, dailySeed);
            // Update game session with resolution data
            game.dailySeed = dailySeed;
            game.dollar1Score = scoreResult.winnerScore === game.dollar1Score ?
                scoreResult.winnerScore : scoreResult.loserScore;
            game.dollar2Score = scoreResult.winnerScore === game.dollar2Score ?
                scoreResult.winnerScore : scoreResult.loserScore;
            // Determine winner and loser
            let winner;
            let loser;
            if (scoreResult.winner === game.dollar1.serialNumber) {
                winner = game.dollar1;
                loser = game.dollar2;
                game.dollar1Score = scoreResult.winnerScore;
                game.dollar2Score = scoreResult.loserScore;
            }
            else {
                winner = game.dollar2;
                loser = game.dollar1;
                game.dollar1Score = scoreResult.loserScore;
                game.dollar2Score = scoreResult.winnerScore;
            }
            // Update game session
            game.winner = winner;
            game.loser = loser;
            // Process player balance transactions if balance manager is available
            if (this.playerBalanceManager) {
                // Process game fees for both players
                this.playerBalanceManager.processGameFee(winner.ownerId);
                this.playerBalanceManager.processGameFee(loser.ownerId);
                // Add winnings to winner's progression
                this.playerBalanceManager.addWinProgression(winner.ownerId, game.winnings);
                // Clear loser's progression
                this.playerBalanceManager.loseProgression(loser.ownerId);
            }
            // Update dollar states
            this.dollarManager.updateDollarState(winner.id, DollarState.WON);
            this.dollarManager.updateDollarState(loser.id, DollarState.LOST);
            // Update dollar game history and statistics
            winner.gameHistory.push(game);
            loser.gameHistory.push(game);
            winner.gamesInThisRun++;
            loser.gamesInThisRun++;
            winner.currentRunWinnings = game.winnings;
            // Note: loser loses their currentRunWinnings (already implied by LOST state)
            // Move game from active to completed
            this.activeGames.delete(gameId);
            this.completedGames.set(gameId, game);
            // Release game session back to factory
            try {
                this.gameSessionFactory.release(game);
            }
            catch (error) {
                console.warn(`Warning: Failed to release game session to factory: ${error}`);
                // Don't throw - release operations should be non-critical
            }
            // Remove from in-game tracking
            this.dollarsInGame.delete(winner.id);
            this.dollarsInGame.delete(loser.id);
            // Emit game resolved event
            this.emit('gameResolved', {
                type: 'gameResolved',
                gameId,
                timestamp: new Date(),
                winnerId: winner.id,
                loserId: loser.id,
                winnings: game.winnings,
                level: game.level
            });
            return {
                success: true,
                gameId,
                winner,
                loser,
                winnings: game.winnings
            };
        }
        catch (error) {
            return {
                success: false,
                gameId,
                winnings: 0,
                error: `Game resolution failed: ${error}`
            };
        }
    }
    /**
     * Get game session by ID
     */
    getGameSession(gameId) {
        return this.activeGames.get(gameId) || this.completedGames.get(gameId) || null;
    }
    /**
     * Get pool statistics
     */
    getPoolStatistics() {
        const dollarsByLevel = {};
        for (let level = 1; level <= 11; level++) {
            const bettingLevel = level;
            dollarsByLevel[bettingLevel] = this.dollarsByLevel.get(bettingLevel)?.size || 0;
        }
        return {
            totalDollarsInPool: this.pooledDollars.size,
            availableForMatching: this.pooledDollars.size - this.dollarsInGame.size,
            dollarsInGame: this.dollarsInGame.size,
            dollarsByLevel,
            totalGamesCompleted: this.completedGames.size
        };
    }
    /**
     * Get comprehensive game statistics
     */
    getStatistics() {
        const gamesByLevel = {};
        let totalPlatformFees = 0;
        let totalWinnings = 0;
        // Initialize level counts
        for (let level = 1; level <= 11; level++) {
            gamesByLevel[level] = 0;
        }
        // Calculate statistics from completed games
        for (const game of Array.from(this.completedGames.values())) {
            gamesByLevel[game.level]++;
            totalPlatformFees += game.platformFee;
            totalWinnings += game.winnings;
        }
        return {
            totalGamesPlayed: this.completedGames.size,
            gamesByLevel,
            totalPlatformFees,
            totalWinnings
        };
    }
    /**
     * Get audit trail of all games
     */
    getAuditTrail() {
        return {
            totalGames: this.completedGames.size,
            gameHistory: Array.from(this.completedGames.values()),
            lastUpdated: new Date()
        };
    }
    /**
     * Get games by player ID
     */
    getGamesByPlayer(playerId) {
        return Array.from(this.completedGames.values()).filter(game => game.dollar1.ownerId === playerId || game.dollar2.ownerId === playerId);
    }
    /**
     * Get games by betting level
     */
    getGamesByLevel(level) {
        return Array.from(this.completedGames.values()).filter(game => game.level === level);
    }
    /**
     * Set maximum concurrent games
     */
    setMaxConcurrentGames(max) {
        if (max < 1) {
            throw new Error('Maximum concurrent games must be at least 1');
        }
        this.maxConcurrentGames = max;
    }
    /**
     * Set PlayerBalanceManager for balance validation
     */
    setPlayerBalanceManager(balanceManager) {
        this.playerBalanceManager = balanceManager;
    }
    /**
     * Event system - add listener
     */
    on(eventType, listener) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            listeners.push(listener);
        }
    }
    /**
     * Event system - remove listener
     */
    off(eventType, listener) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    /**
     * Event system - emit event
     */
    emit(eventType, event) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                }
                catch (error) {
                    console.error(`Error in event listener for ${eventType}:`, error);
                }
            });
        }
    }
    /**
     * Clear all completed games (for memory management)
     */
    clearCompletedGames() {
        // Release all game sessions before clearing
        for (const game of this.completedGames.values()) {
            try {
                this.gameSessionFactory.release(game);
            }
            catch (error) {
                console.warn(`Warning: Failed to release game session during cleanup: ${error}`);
            }
        }
        this.completedGames.clear();
    }
    /**
     * Get active game count
     */
    getActiveGameCount() {
        return this.activeGames.size;
    }
    /**
     * Get factory statistics for performance monitoring
     */
    getFactoryStatistics() {
        return this.gameSessionFactory.getStatistics();
    }
}
//# sourceMappingURL=game-matching-engine.js.map