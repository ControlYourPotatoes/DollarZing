// GameEngineSimulator Implementation - Task 2.3, 2.4
// Component integration simulator that coordinates DayProcessor, PlayerManager, and GameProcessor

import { PlayerBalanceManager } from "../types/player-balance-manager";
import { GameMatchingEngine } from "../types/game-matching-engine";
import { VirtualDollarManager } from "../types/virtual-dollar-types";
import { ScoringEngine } from "../types/scoring-engine";
import { ProgressionManager } from "../types/progression-manager";
import { RevenueCalculator } from "../types/revenue-calculator";
import { CashOutStrategy } from "../types/virtual-dollar-engine";
import { DayProcessor } from "./day-processor";
import { PlayerManager } from "./player-manager";
import { GameProcessor } from "./game-processor";

// ===== CONFIGURATION INTERFACES =====

/**
 * Configuration for simulation execution
 */
export interface SimulationConfig {
  durationDays: number;
  initialPlayerCount: number;
  dailySeed: string;
  charityPercentage: number; // 0.0 to 1.0
  playerStrategies: Partial<Record<CashOutStrategy, number>>; // Distribution percentages
  initialDonationAmount: number;
  maxSimulationTimeMs: number;
  enableProgressReporting: boolean;
}

/**
 * Progress information during simulation execution
 */
export interface SimulationProgress {
  currentDay: number;
  totalDays: number;
  completionPercentage: number; // 0.0 to 1.0
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
 * Daily simulation results
 */
export interface DailyResult {
  day: number;
  playerStatistics: PlayerStatistics;
  gameStatistics: GameStatistics;
  revenueStatistics: RevenueStatistics;
}

/**
 * Complete simulation results
 */
export interface SimulationResults {
  success: boolean;
  error?: string;
  simulationDurationMs: number;
  config: SimulationConfig;
  summary: {
    totalDays: number;
    totalPlayers: number;
    simulationCompleted: boolean;
  };
  playerStats: PlayerStatistics;
  revenueStats: RevenueStatistics;
  gameStats: GameStatistics;
  dailyResults: DailyResult[];
  completedAt: Date;
}

/**
 * Component references for testing and integration
 */
export interface SimulationComponents {
  playerBalanceManager: PlayerBalanceManager;
  gameMatchingEngine: GameMatchingEngine;
  runOrchestrator: ProgressionManager;
  dollarManager: VirtualDollarManager;
  scoringEngine: ScoringEngine;
  progressionManager: ProgressionManager;
  revenueCalculator: RevenueCalculator;
}

// ===== GAME ENGINE SIMULATOR CLASS =====

/**
 * GameEngineSimulator - Component integration simulator that coordinates focused component classes
 * Orchestrates complete simulation runs using DayProcessor, PlayerManager, and GameProcessor
 * This class focuses on component integration rather than statistical modeling
 */
export class GameEngineSimulator {
  private config!: SimulationConfig;
  private components: SimulationComponents;
  private isRunning: boolean = false;
  private startTime: number = 0;
  private simulationAborted: boolean = false;

  // Focused component classes
  public readonly dayProcessor: DayProcessor;
  public readonly playerManager: PlayerManager;
  public readonly gameProcessor: GameProcessor;

  constructor(
    playerBalanceManager: PlayerBalanceManager,
    virtualDollarManager: VirtualDollarManager,
    gameMatchingEngine: GameMatchingEngine,
    runOrchestrator: ProgressionManager,
    revenueCalculator: RevenueCalculator,
    scoringEngine: ScoringEngine
  ) {
    // Create progression manager with proper charity percentage
    const progressionManager = new ProgressionManager(0.1); // Default charity percentage

    this.components = {
      playerBalanceManager,
      gameMatchingEngine,
      runOrchestrator,
      dollarManager: virtualDollarManager,
      scoringEngine,
      progressionManager,
      revenueCalculator,
    };

    // Initialize focused component classes
    this.playerManager = new PlayerManager(
      playerBalanceManager,
      runOrchestrator
    );

    this.dayProcessor = new DayProcessor(
      gameMatchingEngine,
      this.playerManager,
      virtualDollarManager,
      revenueCalculator
    );

    this.gameProcessor = new GameProcessor(
      gameMatchingEngine,
      this.playerManager,
      revenueCalculator,
      virtualDollarManager
    );
  }

  /**
   * Validate configuration parameters
   */
  private validateConfiguration(config: SimulationConfig): void {
    if (config.durationDays < 1) {
      throw new Error("Duration must be at least 1 day");
    }

    if (config.initialPlayerCount < 1) {
      throw new Error("Initial player count must be positive");
    }

    if (config.charityPercentage < 0 || config.charityPercentage > 1) {
      throw new Error("Charity percentage must be between 0 and 1");
    }

    if (config.initialDonationAmount < 0) {
      throw new Error("Initial donation amount cannot be negative");
    }

    if (config.maxSimulationTimeMs < 1000) {
      throw new Error("Maximum simulation time must be at least 1 second");
    }

    // Validate strategy distribution sums to 1.0
    const strategySum = Object.values(config.playerStrategies).reduce(
      (sum, pct) => sum + pct,
      0
    );
    if (Math.abs(strategySum - 1.0) > 0.001) {
      throw new Error("Player strategy percentages must sum to 1.0");
    }

    // Validate strategy percentages are positive
    Object.values(config.playerStrategies).forEach((pct) => {
      if (pct < 0) {
        throw new Error("Player strategy percentages must be non-negative");
      }
    });
  }

  /**
   * Execute complete simulation with progress tracking
   */
  async executeSimulation(
    config: SimulationConfig,
    progressCallback?: (progress: SimulationProgress) => void,
    cancellationToken?: { cancelled: boolean }
  ): Promise<SimulationResults> {
    if (this.isRunning) {
      throw new Error("Simulation is already running");
    }

    this.validateConfiguration(config);
    this.config = config;
    this.isRunning = true;
    this.simulationAborted = false;
    this.startTime = performance.now();

    try {
      return await this.runSimulation(progressCallback, cancellationToken);
    } catch (error) {
      console.error("Simulation error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        simulationDurationMs: performance.now() - this.startTime,
        config: this.config,
        summary: {
          totalDays: this.config.durationDays,
          totalPlayers: this.config.initialPlayerCount,
          simulationCompleted: false,
        },
        playerStats: this.getEmptyPlayerStats(),
        revenueStats: this.getEmptyRevenueStats(),
        gameStats: this.getEmptyGameStats(),
        dailyResults: [],
        completedAt: new Date(),
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run the main simulation loop using focused component classes
   */
  private async runSimulation(
    progressCallback?: (progress: SimulationProgress) => void,
    cancellationToken?: { cancelled: boolean }
  ): Promise<SimulationResults> {
    const { durationDays, enableProgressReporting, maxSimulationTimeMs } =
      this.config;

    // Initialize players using PlayerManager
    const playerCount = this.playerManager.initializePlayers({
      initialPlayerCount: this.config.initialPlayerCount,
      initialDonationAmount: this.config.initialDonationAmount,
      playerStrategies: this.config.playerStrategies,
    });

    const dailyResults: DailyResult[] = [];

    for (let day = 0; day < durationDays; day++) {
      // Check for timeout
      const elapsed = performance.now() - this.startTime;
      if (elapsed > maxSimulationTimeMs) {
        throw new Error(
          `Simulation timeout after ${elapsed}ms (max: ${maxSimulationTimeMs}ms)`
        );
      }

      // Check for cancellation
      if (this.simulationAborted || cancellationToken?.cancelled) {
        throw new Error("Simulation was cancelled");
      }

      // Add new players using PlayerManager
      this.playerManager.addNewPlayersForDay(day, {
        initialPlayerCount: this.config.initialPlayerCount,
        initialDonationAmount: this.config.initialDonationAmount,
        playerStrategies: this.config.playerStrategies,
      });

      // Process the day using DayProcessor
      await this.dayProcessor.processDay(day, {
        initialPlayerCount: this.config.initialPlayerCount,
        maxGamesPerDay: Math.max(10, this.config.initialPlayerCount * 2),
        dailySeed: this.config.dailySeed,
      });

      // Generate daily results
      const dailyResult: DailyResult = {
        day: day + 1,
        playerStatistics: this.playerManager.getPlayerStatistics({
          initialPlayerCount: this.config.initialPlayerCount,
          initialDonationAmount: this.config.initialDonationAmount,
          playerStrategies: this.config.playerStrategies,
        }),
        gameStatistics: this.generateGameStatistics(),
        revenueStatistics: this.generateRevenueStatistics(),
      };

      dailyResults.push(dailyResult);

      // Report progress if enabled
      if (enableProgressReporting && progressCallback) {
        const progress = this.calculateProgress(day + 1, durationDays, elapsed);
        progressCallback(progress);
      }

      // Yield control to prevent UI blocking
      if (day % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    // Generate final results
    const simulationDurationMs = performance.now() - this.startTime;
    return {
      success: true,
      simulationDurationMs,
      config: this.config,
      summary: {
        totalDays: durationDays,
        totalPlayers: playerCount,
        simulationCompleted: true,
      },
      playerStats: this.playerManager.getPlayerStatistics({
        initialPlayerCount: this.config.initialPlayerCount,
        initialDonationAmount: this.config.initialDonationAmount,
        playerStrategies: this.config.playerStrategies,
      }),
      revenueStats: this.generateRevenueStatistics(),
      gameStats: this.generateGameStatistics(),
      dailyResults,
      completedAt: new Date(),
    };
  }

  /**
   * Calculate simulation progress for reporting
   */
  private calculateProgress(
    currentDay: number,
    totalDays: number,
    elapsedTimeMs: number
  ): SimulationProgress {
    const completionPercentage = Math.min(currentDay / totalDays, 1.0);
    const estimatedTotalTime =
      completionPercentage > 0 ? elapsedTimeMs / completionPercentage : 0;
    const estimatedRemainingMs = Math.max(
      0,
      estimatedTotalTime - elapsedTimeMs
    );

    const poolStats = this.components.gameMatchingEngine.getPoolStatistics();
    const activePlayerCount =
      this.components.runOrchestrator.getActivePlayerCount();

    return {
      currentDay,
      totalDays,
      completionPercentage,
      estimatedRemainingMs,
      playersActive: activePlayerCount,
      gamesCompleted: this.components.revenueCalculator.getTotalGames(),
      dollarsInPool: poolStats.totalDollarsInPool,
      elapsedTimeMs,
    };
  }

  /**
   * Generate revenue statistics for final results
   */
  private generateRevenueStatistics(): RevenueStatistics {
    const revenueCalc = this.components.revenueCalculator;
    const totalRevenue = revenueCalc.getPlatformRevenue();
    const totalCharity = revenueCalc.getCharityContributions();
    const totalPayouts = revenueCalc.getPlayerWinnings();
    const totalGames = revenueCalc.getTotalGames();

    const revenuePerGame = totalGames > 0 ? totalRevenue / totalGames : 0;
    const simulationDays = this.config.durationDays;
    const averageRevenuePerDay =
      simulationDays > 0 ? totalRevenue / simulationDays : 0;

    return {
      totalPlatformRevenue: totalRevenue,
      totalCharityContributions: totalCharity,
      totalPlayerPayouts: totalPayouts,
      revenuePerGame,
      charityPercentage: this.config.charityPercentage,
      averageRevenuePerDay,
    };
  }

  /**
   * Generate game statistics for final results
   */
  private generateGameStatistics(): GameStatistics {
    const totalGames = this.components.revenueCalculator.getTotalGames();
    const averageGamesPerDay =
      totalGames / Math.max(this.config.durationDays, 1);

    const dollarManager = this.components.dollarManager;
    const poolStats = dollarManager.getPoolStatistics();
    const totalVirtualDollars = poolStats.totalDollars;

    const runOrchestrator = this.components.runOrchestrator;
    const activeRuns = runOrchestrator.getAllActiveRuns().length;

    const progressionManager = this.components.progressionManager;
    const completedRuns = progressionManager.getCompletedRuns().length;
    const allCompletedRuns = progressionManager.getCompletedRuns();

    // Count jackpots (level 10 completions)
    const jackpotsWon = allCompletedRuns.filter(
      (run) => run.wasJackpot || run.finalLevel === 10
    ).length;

    // Calculate average run length
    const totalRunLength = allCompletedRuns.reduce(
      (sum, run) => sum + run.gamesPlayedInRun,
      0
    );
    const averageRunLength =
      completedRuns > 0 ? totalRunLength / completedRuns : 0;

    return {
      totalGames,
      averageGamesPerDay,
      totalVirtualDollars,
      completedRuns,
      activeRuns,
      jackpotsWon,
      averageRunLength,
    };
  }

  /**
   * Cancel running simulation
   */
  cancelSimulation(): void {
    this.simulationAborted = true;
  }

  /**
   * Get current configuration
   */
  getConfig(): SimulationConfig | undefined {
    return this.config ? { ...this.config } : undefined;
  }

  /**
   * Get component references for testing
   */
  getComponents(): SimulationComponents {
    return this.components;
  }

  /**
   * Check if simulation is currently running
   */
  isSimulationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get empty statistics for error cases
   */
  private getEmptyPlayerStats(): PlayerStatistics {
    return {
      totalPlayers: 0,
      activePlayers: 0,
      retiredPlayers: 0,
      totalDonationsFunds: 0,
      totalWinningsFunds: 0,
      totalProgressionFunds: 0,
      averageGamesPerPlayer: 0,
      playerRetirementRate: 0,
    };
  }

  private getEmptyRevenueStats(): RevenueStatistics {
    return {
      totalPlatformRevenue: 0,
      totalCharityContributions: 0,
      totalPlayerPayouts: 0,
      revenuePerGame: 0,
      charityPercentage: this.config?.charityPercentage || 0,
      averageRevenuePerDay: 0,
    };
  }

  private getEmptyGameStats(): GameStatistics {
    return {
      totalGames: 0,
      averageGamesPerDay: 0,
      totalVirtualDollars: 0,
      completedRuns: 0,
      activeRuns: 0,
      jackpotsWon: 0,
      averageRunLength: 0,
    };
  }
}
