import { PlayerBalanceManager } from './player-balance-manager';
import { GameMatchingEngine } from './game-matching-engine';
import { RunOrchestrator } from './run-orchestrator';
import { VirtualDollarManager } from './virtual-dollar-types';
import { ScoringEngine } from './scoring-engine';
import { ProgressionManager } from './progression-manager';
import { RevenueCalculator } from './revenue-calculator';
import { CashOutStrategy } from './virtual-dollar-engine';
/**
 * Configuration for simulation execution
 */
export interface SimulationConfig {
    durationDays: number;
    initialPlayerCount: number;
    dailySeed: string;
    charityPercentage: number;
    playerStrategies: Record<CashOutStrategy, number>;
    initialDonationAmount: number;
    maxSimulationTimeMs: number;
    enableProgressReporting: boolean;
}
/**
 * Progress information during simulation execution
 */
export interface SimulationProgress {
    currentDay: number;
    completionPercentage: number;
    estimatedRemainingMs: number;
    playersActive: number;
    gamesCompleted: number;
    dollarsInPool: number;
    elapsedTimeMs: number;
}
/**
 * Player statistics from simulation results
 */
export interface PlayerStatistics {
    totalPlayers: number;
    activePlayers: number;
    retiredPlayers: number;
    totalDonationsFunds: number;
    totalWinningsFunds: number;
    totalProgressionFunds: number;
    averageGamesPerPlayer: number;
    playerRetirementRate: number;
}
/**
 * Revenue statistics from simulation results
 */
export interface RevenueStatistics {
    totalPlatformRevenue: number;
    totalCharityContributions: number;
    totalPlayerPayouts: number;
    revenuePerGame: number;
    charityPercentage: number;
    averageRevenuePerDay: number;
}
/**
 * Game statistics from simulation results
 */
export interface GameStatistics {
    totalGames: number;
    averageGamesPerDay: number;
    totalVirtualDollars: number;
    completedRuns: number;
    activeRuns: number;
    jackpotsWon: number;
    averageRunLength: number;
}
/**
 * Complete simulation results
 */
export interface SimulationResults {
    success: boolean;
    error?: string;
    simulationDurationMs: number;
    config: SimulationConfig;
    playerStats: PlayerStatistics;
    revenueStats: RevenueStatistics;
    gameStats: GameStatistics;
    completedAt: Date;
}
/**
 * Component references for testing and integration
 */
export interface SimulationComponents {
    playerBalanceManager: PlayerBalanceManager;
    gameMatchingEngine: GameMatchingEngine;
    runOrchestrator: RunOrchestrator;
    dollarManager: VirtualDollarManager;
    scoringEngine: ScoringEngine;
    progressionManager: ProgressionManager;
    revenueCalculator: RevenueCalculator;
}
/**
 * SimulationController - Master controller that coordinates all engine components
 * Orchestrates complete simulation runs with all component integration
 */
export declare class SimulationController {
    private config;
    private components;
    private isRunning;
    private startTime;
    private simulationAborted;
    constructor(config: SimulationConfig);
    /**
     * Validate configuration parameters - Task 7.5
     */
    private validateConfiguration;
    /**
     * Initialize all engine components with proper dependencies
     */
    private initializeComponents;
    /**
     * Initialize players with starting donation balance - Task 7.3
     */
    initializePlayers(): number;
    /**
     * Run complete simulation with progress tracking - Task 7.7
     */
    runSimulation(progressCallback?: (progress: SimulationProgress) => void): Promise<SimulationResults>;
    /**
     * Execute the main simulation loop
     */
    private executeSimulation;
    /**
     * Process one day of simulation activity
     */
    private processSimulationDay;
    /**
     * Calculate simulation progress for reporting - Task 7.7
     */
    private calculateProgress;
    /**
     * Generate player statistics for final results - Task 7.11
     */
    private generatePlayerStatistics;
    /**
     * Generate revenue statistics for final results - Task 7.11
     */
    private generateRevenueStatistics;
    /**
     * Generate game statistics for final results - Task 7.11
     */
    private generateGameStatistics;
    /**
     * Cancel running simulation - Task 7.9
     */
    cancelSimulation(): void;
    /**
     * Get current configuration
     */
    getConfig(): SimulationConfig;
    /**
     * Get component references for testing
     */
    getComponents(): SimulationComponents;
    /**
     * Check if simulation is currently running
     */
    isSimulationRunning(): boolean;
    /**
     * Get empty statistics for error cases
     */
    private getEmptyPlayerStats;
    private getEmptyRevenueStats;
    private getEmptyGameStats;
}
//# sourceMappingURL=simulation-controller.d.ts.map