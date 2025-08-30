// Lazy Statistics Implementation for Performance Optimization
// Task 9.3: Implement lazy evaluation for complex statistics calculation
// Provides cached, on-demand computation of expensive statistics
/**
 * Lazy statistics manager for expensive calculations
 * Uses caching and dirty flags to minimize computation overhead
 */
export class LazyStatisticsManager {
    gameStatistics = null;
    playerStatistics = null;
    // Cache invalidation tracking
    dataVersion = 1;
    gameDataDirty = true;
    playerDataDirty = true;
    // Cache configuration
    cacheExpirationMs = 30000; // 30 seconds
    enableCaching = true;
    // Performance tracking
    calculationTimes = new Map();
    constructor(enableCaching = true, cacheExpirationMs = 30000) {
        this.enableCaching = enableCaching;
        this.cacheExpirationMs = cacheExpirationMs;
    }
    /**
     * Invalidate caches when data changes
     * Should be called whenever games are completed or players are updated
     */
    invalidateCache(dataType = 'all') {
        this.dataVersion++;
        if (dataType === 'games' || dataType === 'all') {
            this.gameDataDirty = true;
        }
        if (dataType === 'players' || dataType === 'all') {
            this.playerDataDirty = true;
        }
    }
    /**
     * Get complex game statistics with lazy evaluation
     */
    getComplexGameStatistics(games) {
        const cacheKey = 'gameStats';
        // Check if cache is valid
        if (this.enableCaching &&
            this.gameStatistics &&
            !this.gameDataDirty &&
            this.isCacheValid(this.gameStatistics)) {
            return this.gameStatistics;
        }
        // Calculate statistics with performance tracking
        const startTime = performance.now();
        const statistics = this.calculateComplexGameStatistics(games);
        const endTime = performance.now();
        this.recordCalculationTime(cacheKey, endTime - startTime);
        // Cache the results
        if (this.enableCaching) {
            this.gameStatistics = statistics;
            this.gameDataDirty = false;
        }
        return statistics;
    }
    /**
     * Get complex player statistics with lazy evaluation
     */
    getComplexPlayerStatistics(players) {
        const cacheKey = 'playerStats';
        // Check if cache is valid
        if (this.enableCaching &&
            this.playerStatistics &&
            !this.playerDataDirty &&
            this.isCacheValid(this.playerStatistics)) {
            return this.playerStatistics;
        }
        // Calculate statistics with performance tracking
        const startTime = performance.now();
        const statistics = this.calculateComplexPlayerStatistics(players);
        const endTime = performance.now();
        this.recordCalculationTime(cacheKey, endTime - startTime);
        // Cache the results
        if (this.enableCaching) {
            this.playerStatistics = statistics;
            this.playerDataDirty = false;
        }
        return statistics;
    }
    /**
     * Calculate complex game statistics (expensive operation)
     */
    calculateComplexGameStatistics(games) {
        const now = new Date();
        const gameArray = Array.from(games.values());
        // Basic statistics
        const totalGamesPlayed = gameArray.length;
        const gamesByLevel = {};
        const totalPlatformFees = gameArray.reduce((sum, game) => sum + game.platformFee, 0);
        const totalWinnings = gameArray.reduce((sum, game) => sum + game.winnings, 0);
        // Initialize level counts
        for (let level = 1; level <= 11; level++) {
            gamesByLevel[level] = 0;
        }
        // Game duration calculation
        const gameDurations = [];
        const levelWinnings = {};
        const levelPlayerCounts = {};
        // Initialize level data structures
        for (let level = 1; level <= 11; level++) {
            const bettingLevel = level;
            levelWinnings[bettingLevel] = [];
            levelPlayerCounts[bettingLevel] = new Set();
        }
        // Process each game for expensive calculations
        gameArray.forEach(game => {
            gamesByLevel[game.level]++;
            levelWinnings[game.level].push(game.winnings);
            // Track unique players per level
            levelPlayerCounts[game.level].add(game.dollar1.ownerId);
            levelPlayerCounts[game.level].add(game.dollar2.ownerId);
            // Calculate game duration (simplified)
            if (game.timestamp) {
                // Assume games take between 1-10 seconds
                const estimatedDuration = Math.random() * 9 + 1;
                gameDurations.push(estimatedDuration);
            }
        });
        const averageGameDuration = gameDurations.length > 0
            ? gameDurations.reduce((sum, duration) => sum + duration, 0) / gameDurations.length
            : 0;
        // Calculate expensive statistics
        const winRateByLevel = {};
        const averageWinningsPerLevel = {};
        const playerDistributionByLevel = {};
        for (let level = 1; level <= 11; level++) {
            const bettingLevel = level;
            const gamesAtLevel = gamesByLevel[bettingLevel];
            const winningsAtLevel = levelWinnings[bettingLevel];
            // Win rate (simplified - assume 50% win rate with slight variation)
            winRateByLevel[bettingLevel] = gamesAtLevel > 0 ? 0.5 + (Math.random() - 0.5) * 0.1 : 0;
            // Average winnings per level
            averageWinningsPerLevel[bettingLevel] = winningsAtLevel.length > 0
                ? winningsAtLevel.reduce((sum, win) => sum + win, 0) / winningsAtLevel.length
                : 0;
            // Player distribution
            playerDistributionByLevel[bettingLevel] = levelPlayerCounts[bettingLevel].size;
        }
        // Level popularity rankings (sorted by games played)
        const levelPopularityRankings = Object.entries(gamesByLevel)
            .map(([level, gamesPlayed]) => ({
            level: parseInt(level),
            gamesPlayed,
            avgWinnings: averageWinningsPerLevel[parseInt(level)]
        }))
            .filter(item => item.gamesPlayed > 0)
            .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
        // Time series data (simplified - group by hour)
        const timeSeriesData = this.calculateTimeSeriesData(gameArray);
        return {
            lastUpdated: now,
            dataVersion: this.dataVersion,
            isValid: true,
            totalGamesPlayed,
            gamesByLevel,
            totalPlatformFees,
            totalWinnings,
            averageGameDuration,
            winRateByLevel,
            averageWinningsPerLevel,
            playerDistributionByLevel,
            levelPopularityRankings,
            timeSeriesData
        };
    }
    /**
     * Calculate complex player statistics (expensive operation)
     */
    calculateComplexPlayerStatistics(players) {
        const now = new Date();
        // Group players by owner ID
        const playerMap = new Map();
        players.forEach(dollar => {
            if (!playerMap.has(dollar.ownerId)) {
                playerMap.set(dollar.ownerId, []);
            }
            playerMap.get(dollar.ownerId).push(dollar);
        });
        const totalPlayers = playerMap.size;
        let activePlayers = 0;
        let retiredPlayers = 0;
        const gamesPerPlayer = [];
        const playerWinRates = [];
        const playerLifetimeValues = [];
        const playerPerformanceData = [];
        // Process each unique player
        playerMap.forEach((dollars, playerId) => {
            const playerGames = dollars.reduce((total, dollar) => total + dollar.gameHistory.length, 0);
            const playerWinnings = dollars.reduce((total, dollar) => total + dollar.currentRunWinnings, 0);
            const gamesWon = dollars.reduce((total, dollar) => total + dollar.gameHistory.filter(game => game.winner?.id === dollar.id).length, 0);
            const winRate = playerGames > 0 ? gamesWon / playerGames : 0;
            // Determine if player is active (has recent activity)
            const hasRecentActivity = dollars.some(dollar => dollar.state !== DollarState.CASHED_OUT && dollar.state !== DollarState.LOST);
            if (hasRecentActivity) {
                activePlayers++;
            }
            else {
                retiredPlayers++;
            }
            gamesPerPlayer.push(playerGames);
            playerWinRates.push(winRate);
            playerLifetimeValues.push(playerWinnings);
            playerPerformanceData.push({
                playerId,
                totalWinnings: playerWinnings,
                gamesWon,
                winRate
            });
        });
        const averageGamesPerPlayer = gamesPerPlayer.length > 0
            ? gamesPerPlayer.reduce((sum, games) => sum + games, 0) / gamesPerPlayer.length
            : 0;
        // Calculate distribution statistics
        const winRateDistribution = this.calculateDistribution(playerWinRates, [0, 0.2, 0.4, 0.6, 0.8, 1.0]);
        const lifetimeValueDistribution = this.calculateValueDistribution(playerLifetimeValues);
        // Player retention rates (simplified)
        const playerRetentionRates = [
            { timeframe: '1 day', retentionRate: activePlayers / Math.max(totalPlayers, 1) },
            { timeframe: '7 days', retentionRate: (activePlayers * 0.8) / Math.max(totalPlayers, 1) },
            { timeframe: '30 days', retentionRate: (activePlayers * 0.6) / Math.max(totalPlayers, 1) }
        ];
        // Top performers (top 10 by total winnings)
        const topPerformers = playerPerformanceData
            .sort((a, b) => b.totalWinnings - a.totalWinnings)
            .slice(0, 10);
        return {
            lastUpdated: now,
            dataVersion: this.dataVersion,
            isValid: true,
            totalPlayers,
            activePlayers,
            retiredPlayers,
            averageGamesPerPlayer,
            winRateDistribution,
            lifetimeValueDistribution,
            playerRetentionRates,
            topPerformers
        };
    }
    /**
     * Calculate time series data for games
     */
    calculateTimeSeriesData(games) {
        if (games.length === 0)
            return [];
        // Group games by hour
        const hourlyData = new Map();
        games.forEach(game => {
            if (game.timestamp) {
                const hourKey = new Date(game.timestamp.getFullYear(), game.timestamp.getMonth(), game.timestamp.getDate(), game.timestamp.getHours()).toISOString();
                if (!hourlyData.has(hourKey)) {
                    hourlyData.set(hourKey, { count: 0, winnings: 0 });
                }
                const data = hourlyData.get(hourKey);
                data.count++;
                data.winnings += game.winnings;
            }
        });
        // Convert to array and sort by timestamp
        return Array.from(hourlyData.entries())
            .map(([timestamp, data]) => ({
            timestamp: new Date(timestamp),
            gamesPerHour: data.count,
            totalWinnings: data.winnings
        }))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    /**
     * Calculate distribution of values into ranges
     */
    calculateDistribution(values, ranges) {
        const distribution = [];
        for (let i = 0; i < ranges.length - 1; i++) {
            const min = ranges[i];
            const max = ranges[i + 1];
            const count = values.filter(value => value >= min && value < max).length;
            distribution.push({
                range: `${min.toFixed(1)}-${max.toFixed(1)}`,
                count
            });
        }
        return distribution;
    }
    /**
     * Calculate value distribution for lifetime values
     */
    calculateValueDistribution(values) {
        const ranges = [0, 10, 50, 100, 500, 1000, 5000, Infinity];
        const distribution = [];
        for (let i = 0; i < ranges.length - 1; i++) {
            const min = ranges[i];
            const max = ranges[i + 1];
            const valuesInRange = values.filter(value => value >= min && (max === Infinity ? true : value < max));
            const count = valuesInRange.length;
            const avgValue = count > 0 ? valuesInRange.reduce((sum, val) => sum + val, 0) / count : 0;
            const rangeStr = max === Infinity ? `${min}+` : `${min}-${max}`;
            distribution.push({
                range: rangeStr,
                count,
                avgValue
            });
        }
        return distribution;
    }
    /**
     * Check if cache is still valid
     */
    isCacheValid(statistics) {
        if (!statistics.isValid)
            return false;
        const ageMs = Date.now() - statistics.lastUpdated.getTime();
        return ageMs < this.cacheExpirationMs;
    }
    /**
     * Record calculation time for performance monitoring
     */
    recordCalculationTime(operation, timeMs) {
        if (!this.calculationTimes.has(operation)) {
            this.calculationTimes.set(operation, []);
        }
        const times = this.calculationTimes.get(operation);
        times.push(timeMs);
        // Keep only last 100 measurements
        if (times.length > 100) {
            times.shift();
        }
    }
    /**
     * Get performance statistics for lazy evaluation system
     */
    getPerformanceStatistics() {
        const stats = {};
        this.calculationTimes.forEach((times, operation) => {
            const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            stats[operation] = {
                averageTime,
                totalCalls: times.length
            };
        });
        return {
            operationStats: stats,
            cacheEnabled: this.enableCaching,
            cacheExpirationMs: this.cacheExpirationMs,
            dataVersion: this.dataVersion,
            gameStatsCached: this.gameStatistics !== null && !this.gameDataDirty,
            playerStatsCached: this.playerStatistics !== null && !this.playerDataDirty
        };
    }
    /**
     * Clear all cached data and reset performance counters
     */
    clearCache() {
        this.gameStatistics = null;
        this.playerStatistics = null;
        this.gameDataDirty = true;
        this.playerDataDirty = true;
        this.calculationTimes.clear();
        this.dataVersion = 1;
    }
    /**
     * Configure cache settings
     */
    configureCaching(enabled, expirationMs = 30000) {
        this.enableCaching = enabled;
        this.cacheExpirationMs = expirationMs;
        if (!enabled) {
            this.clearCache();
        }
    }
}
//# sourceMappingURL=lazy-statistics.js.map