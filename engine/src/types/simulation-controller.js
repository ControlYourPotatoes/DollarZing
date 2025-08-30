// SimulationController Implementation - Task 7.2
// Master controller that coordinates all engine components
import { PlayerBalanceManager } from './player-balance-manager';
import { GameMatchingEngine } from './game-matching-engine';
import { RunOrchestrator } from './run-orchestrator';
import { VirtualDollarManager } from './virtual-dollar-types';
import { ScoringEngine } from './scoring-engine';
import { ProgressionManager } from './progression-manager';
import { RevenueCalculator } from './revenue-calculator';
import { GameResult } from './virtual-dollar-engine';
// ===== SIMULATION CONTROLLER CLASS =====
/**
 * SimulationController - Master controller that coordinates all engine components
 * Orchestrates complete simulation runs with all component integration
 */
export class SimulationController {
    config;
    components;
    isRunning = false;
    startTime = 0;
    simulationAborted = false;
    constructor(config) {
        this.validateConfiguration(config);
        this.config = config;
        this.components = this.initializeComponents();
    }
    /**
     * Validate configuration parameters - Task 7.5
     */
    validateConfiguration(config) {
        if (config.durationDays < 1) {
            throw new Error('Duration must be at least 1 day');
        }
        if (config.initialPlayerCount < 1) {
            throw new Error('Initial player count must be positive');
        }
        if (config.charityPercentage < 0 || config.charityPercentage > 1) {
            throw new Error('Charity percentage must be between 0 and 1');
        }
        if (config.initialDonationAmount < 0) {
            throw new Error('Initial donation amount cannot be negative');
        }
        if (config.maxSimulationTimeMs < 1000) {
            throw new Error('Maximum simulation time must be at least 1 second');
        }
        // Validate strategy distribution sums to 1.0
        const strategySum = Object.values(config.playerStrategies).reduce((sum, pct) => sum + pct, 0);
        if (Math.abs(strategySum - 1.0) > 0.001) {
            throw new Error('Player strategy percentages must sum to 1.0');
        }
        // Validate strategy percentages are positive
        Object.values(config.playerStrategies).forEach(pct => {
            if (pct < 0) {
                throw new Error('Player strategy percentages must be non-negative');
            }
        });
    }
    /**
     * Initialize all engine components with proper dependencies
     */
    initializeComponents() {
        const dollarManager = new VirtualDollarManager();
        const scoringEngine = new ScoringEngine();
        const progressionManager = new ProgressionManager(this.config.charityPercentage);
        const playerBalanceManager = new PlayerBalanceManager();
        const revenueCalculator = new RevenueCalculator(this.config.charityPercentage);
        // Create game session factory
        const gameSessionFactory = new DirectGameSessionFactory();
        // Create game matching engine with required dependencies
        const gameMatchingEngine = new GameMatchingEngine(dollarManager, scoringEngine, gameSessionFactory);
        // Create run orchestrator with required dependencies  
        const runOrchestrator = new RunOrchestrator(progressionManager, dollarManager, this.config.charityPercentage);
        return {
            playerBalanceManager,
            gameMatchingEngine,
            runOrchestrator,
            dollarManager,
            scoringEngine,
            progressionManager,
            revenueCalculator
        };
    }
    /**
     * Initialize players with starting donation balance - Task 7.3
     */
    initializePlayers() {
        const { initialPlayerCount, initialDonationAmount, playerStrategies } = this.config;
        // Calculate strategy counts
        const strategyCounts = new Map();
        Object.entries(playerStrategies).forEach(([strategy, percentage]) => {
            const count = Math.round(percentage * initialPlayerCount);
            strategyCounts.set(strategy, count);
        });
        // Ensure we have exactly the right number of players
        let totalAssigned = Array.from(strategyCounts.values()).reduce((sum, count) => sum + count, 0);
        if (totalAssigned !== initialPlayerCount) {
            // Adjust the largest group to match exact count
            const largestStrategy = Array.from(strategyCounts.entries())
                .sort(([, a], [, b]) => b - a)[0][0];
            const adjustment = initialPlayerCount - totalAssigned;
            strategyCounts.set(largestStrategy, strategyCounts.get(largestStrategy) + adjustment);
        }
        // Create players with assigned strategies
        let playerIndex = 0;
        strategyCounts.forEach((count, strategy) => {
            for (let i = 0; i < count; i++) {
                const playerId = `player-${playerIndex}`;
                this.components.playerBalanceManager.createPlayer(playerId, initialDonationAmount, strategy);
                // Initialize player in run orchestrator
                this.components.runOrchestrator.initializePlayer(playerId, initialDonationAmount, strategy);
                playerIndex++;
            }
        });
        return playerIndex;
    }
    /**
     * Run complete simulation with progress tracking - Task 7.7
     */
    async runSimulation(progressCallback) {
        if (this.isRunning) {
            throw new Error('Simulation is already running');
        }
        this.isRunning = true;
        this.simulationAborted = false;
        this.startTime = performance.now();
        try {
            return await this.executeSimulation(progressCallback);
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                simulationDurationMs: performance.now() - this.startTime,
                config: this.config,
                playerStats: this.getEmptyPlayerStats(),
                revenueStats: this.getEmptyRevenueStats(),
                gameStats: this.getEmptyGameStats(),
                completedAt: new Date()
            };
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Execute the main simulation loop
     */
    async executeSimulation(progressCallback) {
        const { durationDays, enableProgressReporting, maxSimulationTimeMs } = this.config;
        for (let day = 0; day < durationDays; day++) {
            // Check for timeout
            const elapsed = performance.now() - this.startTime;
            if (elapsed > maxSimulationTimeMs) {
                throw new Error(`Simulation timeout after ${elapsed}ms (max: ${maxSimulationTimeMs}ms)`);
            }
            if (this.simulationAborted) {
                throw new Error('Simulation was cancelled');
            }
            // Process one day of simulation
            await this.processSimulationDay(day);
            // Report progress if enabled
            if (enableProgressReporting && progressCallback) {
                const progress = this.calculateProgress(day + 1, durationDays, elapsed);
                progressCallback(progress);
            }
            // Yield control to prevent UI blocking
            if (day % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        // Generate final results
        const simulationDurationMs = performance.now() - this.startTime;
        return {
            success: true,
            simulationDurationMs,
            config: this.config,
            playerStats: this.generatePlayerStatistics(),
            revenueStats: this.generateRevenueStatistics(simulationDurationMs),
            gameStats: this.generateGameStatistics(),
            completedAt: new Date()
        };
    }
    /**
     * Process one day of simulation activity
     */
    async processSimulationDay(_day) {
        // Auto-create new runs for eligible players
        const newRuns = this.components.runOrchestrator.autoCreateRuns(2); // Max 2 concurrent runs per player
        // Add new virtual dollars to the pool
        newRuns.forEach(virtualDollar => {
            this.components.gameMatchingEngine.addToPool(virtualDollar);
        });
        // Process available games for the day
        const maxGamesPerDay = Math.max(10, this.config.initialPlayerCount * 2);
        for (let gameAttempt = 0; gameAttempt < maxGamesPerDay; gameAttempt++) {
            const matchResult = this.components.gameMatchingEngine.attemptMatching();
            if (matchResult.gamesCreated.length === 0) {
                break; // No more matches possible
            }
            // Process game results through run orchestrator
            matchResult.gamesCreated.forEach(gameSession => {
                const winner = gameSession.winner;
                const loser = gameSession.loser;
                // Process winner progression
                const winnerResult = this.components.runOrchestrator.processGameResult(winner, GameResult.WIN);
                // Process loser result
                const loserResult = this.components.runOrchestrator.processGameResult(loser, GameResult.LOSS);
                // Handle run completions and create new runs
                [winnerResult, loserResult].forEach(result => {
                    if (result && result.shouldCreateNewRun) {
                        const playerStrategy = this.components.runOrchestrator.getPlayerStrategy(result.playerId);
                        const newRun = this.components.runOrchestrator.createNewRun({
                            playerId: result.playerId,
                            cashOutStrategy: playerStrategy,
                            fundingSource: 'DONATION'
                        });
                        if (newRun) {
                            this.components.gameMatchingEngine.addToPool(newRun);
                        }
                    }
                });
            });
            // Small delay to prevent blocking
            if (gameAttempt % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }
    /**
     * Calculate simulation progress for reporting - Task 7.7
     */
    calculateProgress(currentDay, totalDays, elapsedTimeMs) {
        const completionPercentage = Math.min(currentDay / totalDays, 1.0);
        const estimatedTotalTime = completionPercentage > 0 ? elapsedTimeMs / completionPercentage : 0;
        const estimatedRemainingMs = Math.max(0, estimatedTotalTime - elapsedTimeMs);
        const poolStats = this.components.gameMatchingEngine.getPoolStatistics();
        const activePlayerCount = this.components.runOrchestrator.getActivePlayerCount();
        return {
            currentDay,
            completionPercentage,
            estimatedRemainingMs,
            playersActive: activePlayerCount,
            gamesCompleted: this.components.revenueCalculator.getTotalGames(),
            dollarsInPool: poolStats.totalDollarsInPool,
            elapsedTimeMs
        };
    }
    /**
     * Generate player statistics for final results - Task 7.11
     */
    generatePlayerStatistics() {
        const balanceManager = this.components.playerBalanceManager;
        const totalDonationFunds = balanceManager.getTotalDonations();
        const totalWinningsFunds = balanceManager.getTotalWinnings();
        const activePlayers = this.components.runOrchestrator.getActivePlayerCount();
        const totalPlayers = this.config.initialPlayerCount;
        const retiredPlayers = totalPlayers - activePlayers;
        const totalGames = this.components.revenueCalculator.getTotalGames();
        const averageGamesPerPlayer = totalGames / Math.max(totalPlayers, 1);
        const playerRetirementRate = retiredPlayers / totalPlayers;
        // Calculate total progression funds from active runs
        const activeRuns = this.components.runOrchestrator.getAllActiveRuns();
        const totalProgressionFunds = activeRuns.reduce((sum, dollar) => {
            return sum + dollar.currentRunWinnings;
        }, 0);
        return {
            totalPlayers,
            activePlayers,
            retiredPlayers,
            totalDonationsFunds: totalDonationFunds,
            totalWinningsFunds: totalWinningsFunds,
            totalProgressionFunds: totalProgressionFunds,
            averageGamesPerPlayer,
            playerRetirementRate
        };
    }
    /**
     * Generate revenue statistics for final results - Task 7.11
     */
    generateRevenueStatistics(_simulationDurationMs) {
        const revenueCalc = this.components.revenueCalculator;
        const totalRevenue = revenueCalc.getPlatformRevenue();
        const totalCharity = revenueCalc.getCharityContributions();
        const totalPayouts = revenueCalc.getPlayerWinnings();
        const totalGames = revenueCalc.getTotalGames();
        const revenuePerGame = totalGames > 0 ? totalRevenue / totalGames : 0;
        const simulationDays = this.config.durationDays;
        const averageRevenuePerDay = simulationDays > 0 ? totalRevenue / simulationDays : 0;
        return {
            totalPlatformRevenue: totalRevenue,
            totalCharityContributions: totalCharity,
            totalPlayerPayouts: totalPayouts,
            revenuePerGame,
            charityPercentage: this.config.charityPercentage,
            averageRevenuePerDay
        };
    }
    /**
     * Generate game statistics for final results - Task 7.11
     */
    generateGameStatistics() {
        const totalGames = this.components.revenueCalculator.getTotalGames();
        const averageGamesPerDay = totalGames / Math.max(this.config.durationDays, 1);
        const dollarManager = this.components.dollarManager;
        const poolStats = dollarManager.getPoolStatistics();
        const totalVirtualDollars = poolStats.totalDollars;
        const runOrchestrator = this.components.runOrchestrator;
        const activeRuns = runOrchestrator.getAllActiveRuns().length;
        const progressionManager = this.components.progressionManager;
        const completedRuns = progressionManager.getCompletedRuns().length;
        const allCompletedRuns = progressionManager.getCompletedRuns();
        // Count jackpots (level 10 completions)
        const jackpotsWon = allCompletedRuns.filter(run => run.wasJackpot || run.finalLevel === 10).length;
        // Calculate average run length
        const totalRunLength = allCompletedRuns.reduce((sum, run) => sum + run.gamesPlayedInRun, 0);
        const averageRunLength = completedRuns > 0 ? totalRunLength / completedRuns : 0;
        return {
            totalGames,
            averageGamesPerDay,
            totalVirtualDollars,
            completedRuns,
            activeRuns,
            jackpotsWon,
            averageRunLength
        };
    }
    /**
     * Cancel running simulation - Task 7.9
     */
    cancelSimulation() {
        this.simulationAborted = true;
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get component references for testing
     */
    getComponents() {
        return this.components;
    }
    /**
     * Check if simulation is currently running
     */
    isSimulationRunning() {
        return this.isRunning;
    }
    /**
     * Get empty statistics for error cases
     */
    getEmptyPlayerStats() {
        return {
            totalPlayers: 0,
            activePlayers: 0,
            retiredPlayers: 0,
            totalDonationsFunds: 0,
            totalWinningsFunds: 0,
            totalProgressionFunds: 0,
            averageGamesPerPlayer: 0,
            playerRetirementRate: 0
        };
    }
    getEmptyRevenueStats() {
        return {
            totalPlatformRevenue: 0,
            totalCharityContributions: 0,
            totalPlayerPayouts: 0,
            revenuePerGame: 0,
            charityPercentage: this.config?.charityPercentage || 0,
            averageRevenuePerDay: 0
        };
    }
    getEmptyGameStats() {
        return {
            totalGames: 0,
            averageGamesPerDay: 0,
            totalVirtualDollars: 0,
            completedRuns: 0,
            activeRuns: 0,
            jackpotsWon: 0,
            averageRunLength: 0
        };
    }
}
//# sourceMappingURL=simulation-controller.js.map