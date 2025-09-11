// This is line 1
// GameEngineSimulator Implementation - Pure Event-Driven Architecture
// Event orchestrator that coordinates event handlers without direct component dependencies

import { GameMatchingEngine } from "../types/game-matching-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { RevenueCalculator } from "../types/revenue-calculator";
import { CashOutStrategy } from "../types/virtual-dollar-engine";
import { EventBus } from "../events/event-bus";
import { GameEventHandler } from "../events/handlers/game-event-handler";
import { PlayerProgressionHandler } from "../events/handlers/player-progression-handler";
import { CashOutDecisionHandler } from "../events/handlers/cash-out-decision-handler";
import { PoolManagementHandler } from "../events/handlers/pool-management-handler";
import { RevenueTrackingHandler } from "../events/handlers/revenue-tracking-handler";
import { VirtualDollarFactory } from "../types/factory-interfaces";

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
  // Add S-curve growth model parameters
  growthModel: {
    adoptionRate: number; // 0.01, 0.1, or 0.5 for Conservative/Market/Viral
    baseMarket: number; // Base market size (e.g., 1,000,000)
    midpointDay: number; // Day 90 for S-curve inflection
    steepnessFactor: number; // 20 for curve steepness
  };
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
 * Component references for testing and integration (pure event-driven)
 */
export interface SimulationComponents {
  gameMatchingEngine: GameMatchingEngine;
  dollarManager: VirtualDollarManager;
  revenueCalculator: RevenueCalculator;
  virtualDollarFactory: VirtualDollarFactory;
}

// ===== GAME ENGINE SIMULATOR CLASS =====

/**
 * GameEngineSimulator - Pure Event Orchestrator
 * Emits events and coordinates event handlers without direct component dependencies
 * All business logic is handled by event handlers
 */
export class GameEngineSimulator {
  private config!: SimulationConfig;
  private components: SimulationComponents;
  private isRunning: boolean = false;
  private startTime: number = 0;
  private simulationAborted: boolean = false;

  // Event system
  private eventBus: EventBus;
  private eventHandlers: any[] = [];

  constructor(
    gameMatchingEngine: GameMatchingEngine,
    virtualDollarManager: VirtualDollarManager,
    virtualDollarFactory: VirtualDollarFactory,
    revenueCalculator: RevenueCalculator,
    eventBus?: EventBus
  ) {
    // Initialize event system
    this.eventBus = eventBus || new EventBus();

    // Update GameMatchingEngine to use centralized EventBus
    gameMatchingEngine.setEventBus(this.eventBus);

    this.components = {
      gameMatchingEngine,
      dollarManager: virtualDollarManager,
      revenueCalculator,
      virtualDollarFactory,
    };

    // Initialize complete event handler system
    this.eventHandlers = [
      new GameEventHandler(
        this.eventBus,
        gameMatchingEngine,
        revenueCalculator
      ),
      new PoolManagementHandler(
        this.eventBus,
        gameMatchingEngine,
        virtualDollarManager
      ),
      new RevenueTrackingHandler(this.eventBus, revenueCalculator),
    ];
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

    // Create strategy manager with config-based player strategies
    const strategyManager = this.createStrategyManager(config.playerStrategies);

    // Create CashOutDecisionHandler with configured strategy manager
    const cashOutDecisionHandler = new CashOutDecisionHandler(
      this.eventBus,
      strategyManager
    );
    this.eventHandlers.push(cashOutDecisionHandler);

    // Create PlayerProgressionHandler with VirtualDollarFactory for event-driven progression
    const playerProgressionHandler = new PlayerProgressionHandler(
      this.eventBus,
      this.components.virtualDollarFactory
    );
    this.eventHandlers.push(playerProgressionHandler);

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
   * Run the main simulation loop using pure event-driven architecture
   */
  private async runSimulation(
    progressCallback?: (progress: SimulationProgress) => void,
    cancellationToken?: { cancelled: boolean }
  ): Promise<SimulationResults> {
    const { durationDays, enableProgressReporting, maxSimulationTimeMs } =
      this.config;

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

      // Use DayProcessor to handle the daily simulation
      const { DayProcessor } = await import("./day-processor");
      const { PlayerManager } = await import("./player-manager");

      // Create PlayerManager with required dependencies (following integration test pattern)
      const { PlayerBalanceManager } = await import(
        "../types/player-balance-manager"
      );

      const playerBalanceManager = new PlayerBalanceManager();

      // Create a simple implementation of PlayerRunManager interface
      const runOrchestrator = {
        initializePlayer: (
          _playerId: string,
          _initialDonationAmount: number,
          _cashOutStrategy: any
        ) => {
          // Simple implementation - just log for now
          console.log(
            `Initializing player ${_playerId} with ${_initialDonationAmount} and strategy ${_cashOutStrategy}`
          );
        },
        getActivePlayerCount: () => 0,
        getPlayerStrategy: (_playerId: string) => "BALANCED" as any,
        getAllActiveRuns: () => [],
        processGameResult: (_virtualDollar: any, _result: any) => {
          // Simple implementation - return null for now
          return null;
        },
        createNewRun: (request: any) =>
          this.components.virtualDollarFactory.create(request.playerId),
        autoCreateRuns: (_maxRunsPerPlayer?: number) => [],
      };

      const playerManager = new PlayerManager(
        playerBalanceManager,
        runOrchestrator,
        this.eventBus
      );

      const dayProcessor = new DayProcessor(
        this.components.gameMatchingEngine,
        playerManager,
        this.components.dollarManager,
        this.eventBus
      );

      await dayProcessor.processDay(
        day,
        {
          initialPlayerCount: this.config.initialPlayerCount,
          maxGamesPerDay: Math.max(25, this.config.initialPlayerCount * 2),
          dailySeed: this.config.dailySeed,
        },
        this.config
      );

      // Generate daily results from current state
      const dailyResult: DailyResult = {
        day: day + 1,
        playerStatistics: this.getPlayerStatisticsFromState(),
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
        totalPlayers: this.config.initialPlayerCount,
        simulationCompleted: true,
      },
      playerStats: this.getPlayerStatisticsFromState(),
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
    const activePlayerCount = poolStats.totalDollarsInPool;

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
   * Get total players from event-driven state
   */
  private getTotalPlayersFromRevenueCalc(): number {
    // In event-driven architecture, use pool statistics as proxy for active players
    const poolStats = this.components.gameMatchingEngine.getPoolStatistics();
    return Math.max(
      this.config.initialPlayerCount,
      poolStats.totalDollarsInPool
    );
  }

  /**
   * Get player statistics from event-driven state
   */
  private getPlayerStatisticsFromState(): PlayerStatistics {
    // In pure event-driven architecture, get stats from event handlers
    const totalPlayers = this.getTotalPlayersFromRevenueCalc();
    const poolStats = this.components.gameMatchingEngine.getPoolStatistics();
    const activePlayers = poolStats.totalDollarsInPool;
    const retiredPlayers = Math.max(0, totalPlayers - activePlayers);

    // Get financial data from RevenueCalculator (managed by RevenueTrackingHandler)
    const totalWinningsFunds =
      this.components.revenueCalculator.getPlayerWinnings();

    return {
      totalPlayers,
      activePlayers,
      retiredPlayers,
      totalDonationsFunds: 0, // Tracked via events now
      totalWinningsFunds,
      totalProgressionFunds: poolStats.dollarsInGame, // Active progression funds
      averageGamesPerPlayer:
        totalPlayers > 0
          ? this.components.revenueCalculator.getTotalGames() / totalPlayers
          : 0,
      playerRetirementRate:
        totalPlayers > 0 ? retiredPlayers / totalPlayers : 0,
    };
  }

  /**
   * Generate revenue statistics from event-driven state
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
   * Generate game statistics from event-driven state
   */
  private generateGameStatistics(): GameStatistics {
    const totalGames = this.components.revenueCalculator.getTotalGames();
    const averageGamesPerDay =
      totalGames / Math.max(this.config.durationDays, 1);

    const poolStats = this.components.dollarManager.getPoolStatistics();
    const totalVirtualDollars = poolStats.totalDollars;

    // In event-driven architecture, we don't have direct access to completed runs
    // This would be tracked via RUN_COMPLETED events in a proper implementation
    return {
      totalGames,
      averageGamesPerDay,
      totalVirtualDollars,
      completedRuns: 0, // Would need event tracking
      activeRuns: poolStats.totalDollars,
      jackpotsWon: 0, // Would need event tracking
      averageRunLength:
        totalGames > 0 ? totalGames / Math.max(poolStats.totalDollars, 1) : 0,
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

  /**
   * Create strategy manager with proper cash-out probability formulas
   */
  private createStrategyManager(
    playerStrategies: Partial<Record<CashOutStrategy, number>>
  ) {
    // Create player ID to strategy mapping based on distribution
    const playerStrategiesMap = new Map<string, CashOutStrategy>();

    // Helper function to get cash-out probability based on strategy
    const getCashOutProbability = (
      level: number,
      strategy: CashOutStrategy
    ): number => {
      switch (strategy) {
        case CashOutStrategy.CONSERVATIVE:
          return Math.max(0.9 - level / 100, 0.1);
        case CashOutStrategy.BALANCED:
          return 0.3;
        case CashOutStrategy.AGGRESSIVE:
          return Math.min(0.1 + level / 100, 0.9);
        default:
          return 0.3;
      }
    };

    return {
      getPlayerStrategy: (playerId: string): CashOutStrategy => {
        if (!playerStrategiesMap.has(playerId)) {
          // Assign strategy based on distribution when first accessed
          const strategies = Object.keys(playerStrategies) as CashOutStrategy[];
          const weights = Object.values(playerStrategies);
          const randomValue = Math.random();
          let cumulativeWeight = 0;

          for (let i = 0; i < strategies.length; i++) {
            cumulativeWeight += weights[i];
            if (randomValue <= cumulativeWeight) {
              playerStrategiesMap.set(playerId, strategies[i]);
              return strategies[i];
            }
          }
          playerStrategiesMap.set(playerId, CashOutStrategy.BALANCED); // fallback
        }
        return playerStrategiesMap.get(playerId)!;
      },

      makeCashOutDecision: (context: any): "CASH_OUT" | "CONTINUE" => {
        const strategy =
          playerStrategiesMap.get(context.playerId) || CashOutStrategy.BALANCED;
        const probability = getCashOutProbability(
          context.currentLevel,
          strategy
        );
        return Math.random() < probability ? "CASH_OUT" : "CONTINUE";
      },

      getCashOutProbability,

      processDecision: (context: any) => ({
        finalLevel: context.currentLevel,
        totalWinnings: context.totalWinnings,
        completed: true,
      }),
    };
  }

  /**
   * Clean up event handlers
   */
  dispose(): void {
    this.eventHandlers.forEach((handler) => {
      if (handler.dispose) {
        handler.dispose();
      }
    });
    this.eventHandlers = [];
  }
}
