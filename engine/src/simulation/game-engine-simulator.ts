// This is line 1
// GameEngineSimulator Implementation - Pure Event-Driven Architecture
// Event orchestrator that coordinates event handlers without direct component dependencies

import { GameMatchingEngine } from "../core/game-matching-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { RevenueCalculator } from "../core/revenue-calculator";
import { BettingLevel, CashOutStrategy } from "../types/virtual-dollar-engine";
import { EventBus, EventSubscription } from "../events/event-bus";
import { GameEventHandler } from "../events/handlers/game-event-handler";
import { PlayerProgressionHandler } from "../events/handlers/player-progression-handler";
import {
  CashOutDecisionHandler,
  IStrategyManager,
  DecisionProcessContext,
} from "../events/handlers/cash-out-decision-handler";
// PoolManagementHandler removed - re-pooling logic moved to PlayerProgressionHandler
import { RevenueTrackingHandler } from "../events/handlers/revenue-tracking-handler";
import {
  LevelTrackingHandler,
  type LevelTrackingSnapshot,
} from "../events/handlers/level-tracking-handler";
import { MatchmakingEventHandler } from "../events/handlers/matchmaking-event-handler";
import { PooledGameSessionFactory } from "../factories";
import {
  EVENT_TYPES,
  NewRunCreatedEvent,
  DayFrameCompletedEvent,
} from "../events/event-types";
import {
  DEFAULT_RUNTIME_OPTIONS,
  DEFAULT_SIMULATION_PROFILE_NAME,
  SimulationProfile,
  SimulationRuntimeOptions,
  isSimulationProfile,
} from "./simulation-profiles";
import {
  generateDailyAggregates,
  type DailyAggregateSnapshot,
} from "./post-processing/daily-aggregator";
import {
  type SimulationTermination,
  type SimulationAbortReason,
} from "../types/simulation-termination";
import type { EventDebugInterface } from "../events/debug/index";

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
  // Number of days to spread initial player seeding across (optional)
  initialPlayerSpreadDays?: number;
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
  activePlayers: number; // DAU target - number of players we aim to keep active daily
  retiredPlayers: number; // Players not in DAU target (inactive/retired)
  completedRunsPlayers: number; // Players who completed their runs (cashed out or eliminated)
  totalCharityContributions: number; // Duplicate of revenueStatistics.totalCharityContributions for player charts
  totalPlayerPayouts: number; // Duplicate of revenueStatistics.totalPlayerPayouts for player charts
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
  totalCashOuts: number;
  cashOutCount: number;
}

/**
 * Game statistics from simulation results
 */
export interface GameStatistics {
  totalGames: number;
  averageGamesPerDay: number;
  pooledVirtualDollars: number; // Virtual dollars currently in matching pool
  totalVirtualDollars: number; // Total virtual dollars created throughout simulation
  totalRunsCreated: number;
  completedRuns: number;
  activeRuns: number; // Same as pooledVirtualDollars - runs currently in pool
  jackpotsWon: number;
  averageRunLength: number;
  resolvedGames?: number;
  gamesByLevel?: Record<BettingLevel, number>;
  peakPoolSize?: number;
}

/**
 * Daily simulation results
 */
export interface DailyResult {
  day: number;
  playerStatistics: PlayerStatistics;
  gameStatistics: GameStatistics;
  revenueStatistics: RevenueStatistics;
  newPlayers: number; // Number of new players added this day
  playerCreation: {
    initialPlayers: number;
    growthPlayers: number;
    dauNewPlayers: number;
    reactivatedPlayers: number;
  };
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
  dailyAggregates?: DailyAggregateSnapshot[];
  levelTrackingSnapshot?: LevelTrackingSnapshot;
  completedAt: Date;
  termination?: SimulationTermination;
}

/**
 * Component references for testing and integration (pure event-driven)
 */
export interface SimulationComponents {
  gameMatchingEngine: GameMatchingEngine;
  virtualDollarFactory: VirtualDollarFactory;
  revenueCalculator: RevenueCalculator;
  dayProcessor: any; // DayProcessor - will be injected
  playerManager: any; // PlayerManager - will be injected
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
  private runtimeOptions: SimulationRuntimeOptions = {
    ...DEFAULT_RUNTIME_OPTIONS,
  };

  // Event system
  private eventBus: EventBus;
  private eventHandlers: any[] = [];
  private revenueTrackingHandler!: RevenueTrackingHandler;
  private levelTrackingHandler!: LevelTrackingHandler;
  private playerProgressionHandler: PlayerProgressionHandler | null = null;
  private runMetrics = {
    totalRunsCreated: 0,
  };
  private runCreatedSubscription: EventSubscription | null = null;
  private dailyNewPlayers: number = 0; // Track new players for current day
  private dailyPlayerCreation: {
    initialPlayers: number;
    growthPlayers: number;
    dauNewPlayers: number;
    reactivatedPlayers: number;
  } = {
    initialPlayers: 0,
    growthPlayers: 0,
    dauNewPlayers: 0,
    reactivatedPlayers: 0,
  };
  private pendingDailyResults: DailyResult[] = [];
  private dayCompletedSubscription: EventSubscription | null = null;
  private dayFrameCompletedSubscription: EventSubscription | null = null;
  private terminationState: SimulationTermination | null = null;
  private lastAbortReason: SimulationAbortReason | null = null;

  constructor(
    gameMatchingEngine: GameMatchingEngine,
    virtualDollarFactory: VirtualDollarFactory,
    revenueCalculator: RevenueCalculator,
    dayProcessor: any, // DayProcessor injected
    playerManager: any, // PlayerManager injected
    eventBus?: EventBus,
    private debugInterface?: EventDebugInterface, // Debug interface for event inspection
    private verbose?: boolean
  ) {
    // Initialize event system
    this.eventBus = eventBus || new EventBus();

    // Update GameMatchingEngine to use centralized EventBus
    gameMatchingEngine.setEventBus(this.eventBus);

    this.components = {
      gameMatchingEngine,
      virtualDollarFactory,
      revenueCalculator,
      dayProcessor,
      playerManager,
    };

    this.components.gameMatchingEngine.setAbortCallback((reason) => {
      this.simulationAborted = true;
      this.lastAbortReason = reason ?? {
        code: "UNKNOWN",
        message: "Simulation aborted without explicit reason",
      };
    });

    // Initialize basic event handler system (strategy-dependent handlers created in executeSimulation)
    this.revenueTrackingHandler = new RevenueTrackingHandler(
      this.eventBus,
      this.components.revenueCalculator,
      undefined,
      this.debugInterface,
      this.verbose
    );

    // Initialize level tracking handler
    this.levelTrackingHandler = new LevelTrackingHandler(
      this.eventBus,
      this.debugInterface,
      this.verbose
    );

    this.eventHandlers = [
      new GameEventHandler(
        this.eventBus,
        gameMatchingEngine,
        this.debugInterface,
        this.verbose
      ),
      new MatchmakingEventHandler(
        this.eventBus,
        gameMatchingEngine,
        virtualDollarFactory,
        new PooledGameSessionFactory({
          enableObjectPooling: false,
          poolSizes: { virtualDollar: 100, gameSession: 50 },
          prewarmCounts: { virtualDollar: 10, gameSession: 5 },
          enableBatchOptimizations: false,
          enablePerformanceMetrics: false,
        }),
        this.debugInterface,
        this.verbose
      ),
      this.revenueTrackingHandler,
    ];

    this.runCreatedSubscription = this.eventBus.on<NewRunCreatedEvent>(
      EVENT_TYPES.NEW_RUN_CREATED,
      this.handleRunCreated.bind(this)
    );

    this.dayCompletedSubscription = this.eventBus.on<any>(
      EVENT_TYPES.DAY_COMPLETED,
      this.handleDayCompleted.bind(this)
    );

    this.dayFrameCompletedSubscription =
      this.eventBus.on<DayFrameCompletedEvent>(
        EVENT_TYPES.DAY_FRAME_COMPLETED,
        this.handleDayFrameCompleted.bind(this)
      );
  }

  private handleRunCreated(_event: NewRunCreatedEvent): void {
    if (!this.isRunning) {
      return;
    }

    this.runMetrics.totalRunsCreated += 1;
  }

  private handleDayCompleted(event: any): void {
    if (!this.isRunning) {
      return;
    }

    // Capture new players count from the day completed event
    this.dailyNewPlayers = event.newPlayers || 0;
    const creation = event.playerCreation ?? {
      initialPlayers: 0,
      growthPlayers: 0,
      dauNewPlayers: 0,
      reactivatedPlayers: 0,
    };
    this.dailyPlayerCreation = {
      initialPlayers: creation.initialPlayers ?? 0,
      growthPlayers: creation.growthPlayers ?? 0,
      dauNewPlayers: creation.dauNewPlayers ?? 0,
      reactivatedPlayers: creation.reactivatedPlayers ?? 0,
    };
  }

  private handleDayFrameCompleted(event: DayFrameCompletedEvent): void {
    if (!this.isRunning) {
      return;
    }

    this.finalizeDayResults(event.dayNumber, event.summary);
  }

  private finalizeDayResults(
    dayNumber: number,
    summary?: DayFrameCompletedEvent["summary"]
  ): void {
    // Validate coherence before pushing daily result
    if (!this.config || dayNumber < 1 || dayNumber > this.config.durationDays) {
      return;
    }

    const existing = this.pendingDailyResults[dayNumber - 1];
    if (!existing) {
      return;
    }

    if (summary) {
      const updatedGameStats: GameStatistics = {
        ...existing.gameStatistics,
        resolvedGames: summary.resolvedGames,
        activeRuns: summary.activePlayers,
      };
      if (typeof summary.peakPoolSize === "number") {
        updatedGameStats.peakPoolSize = summary.peakPoolSize;
      }
      existing.gameStatistics = updatedGameStats;
      existing.newPlayers = summary.newPlayers ?? existing.newPlayers;
      existing.playerStatistics = {
        ...existing.playerStatistics,
        totalPlayers: summary.activePlayers,
      };
      if (summary.playerCreation) {
        existing.playerCreation = {
          initialPlayers:
            summary.playerCreation.initialPlayers ??
            existing.playerCreation.initialPlayers,
          growthPlayers:
            summary.playerCreation.growthPlayers ??
            existing.playerCreation.growthPlayers,
          dauNewPlayers:
            summary.playerCreation.dauNewPlayers ??
            existing.playerCreation.dauNewPlayers,
          reactivatedPlayers:
            summary.playerCreation.reactivatedPlayers ??
            existing.playerCreation.reactivatedPlayers,
        };
      }
    }
  }

  private resetRunMetrics(): void {
    this.runMetrics.totalRunsCreated = 0;
  }

  private updateLoggingPreferences(loggingEnabled: boolean): void {
    if (this.revenueTrackingHandler) {
      this.revenueTrackingHandler.updateConfiguration({ loggingEnabled });
    }

    if (this.playerProgressionHandler) {
      // PlayerProgressionHandler now uses debugInterface for logging control
    }

    const dayProcessor = this.components.dayProcessor as {
      setLoggingEnabled?: (enabled: boolean) => void;
    };

    dayProcessor?.setLoggingEnabled?.(loggingEnabled);
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
    configOrProfile: SimulationConfig | SimulationProfile,
    progressCallback?: (progress: SimulationProgress) => void,
    cancellationToken?: { cancelled: boolean }
  ): Promise<SimulationResults> {
    if (this.isRunning) {
      throw new Error("Simulation is already running");
    }

    const { config, runtime } = this.normalizeSimulationInput(configOrProfile);

    this.validateConfiguration(config);
    this.config = config;
    this.runtimeOptions = runtime;
    this.updateLoggingPreferences(runtime.collectEventTraces);
    this.resetRunMetrics();
    this.isRunning = true;
    this.simulationAborted = false;
    this.startTime = performance.now();

    // Create strategy manager with config-based player strategies
    const strategyManager = this.createStrategyManager();

    // Create CashOutDecisionHandler with configured strategy manager
    if (this.verbose) {
      console.log("[Simulator] Attaching CashOutDecisionHandler");
    }
    const cashOutDecisionHandler = new CashOutDecisionHandler(
      this.eventBus,
      strategyManager,
      this.debugInterface,
      this.verbose
    );
    this.eventHandlers.push(cashOutDecisionHandler);

    // Create PlayerProgressionHandler with VirtualDollarFactory for event-driven progression
    const loggingEnabled = this.runtimeOptions.collectEventTraces;
    if (this.verbose) {
      console.log("[Simulator] Attaching PlayerProgressionHandler");
    }
    this.playerProgressionHandler = new PlayerProgressionHandler(
      this.eventBus,
      this.components.virtualDollarFactory,
      this.components.gameMatchingEngine,
      { loggingEnabled },
      this.debugInterface,
      this.verbose
    );
    this.eventHandlers.push(this.playerProgressionHandler);

    if (this.verbose) {
      console.log(
        `[Simulator] Total listener count: ${this.eventBus.getListenerCount()}`
      );
      console.log("[Simulator] Listener summary");
      for (const [eventType, count] of this.eventBus.getListeners()) {
        console.log(`  - ${eventType}: ${count}`);
      }
    }

    // Add level tracking handler
    this.eventHandlers.push(this.levelTrackingHandler);
    this.updateLoggingPreferences(loggingEnabled);

    try {
      return await this.runSimulation(progressCallback, cancellationToken);
    } catch (error) {
      console.error("Simulation error:", error);

      const playerStats = this.getEmptyPlayerStats();
      const revenueStats = this.getEmptyRevenueStats();
      const gameStats = this.getEmptyGameStats();

      const errorResults: SimulationResults = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        simulationDurationMs: performance.now() - this.startTime,
        config: this.config,
        summary: {
          totalDays: this.config.durationDays,
          totalPlayers: playerStats.totalPlayers,
          simulationCompleted: false,
        },
        playerStats,
        revenueStats,
        gameStats,
        dailyResults: [],
        dailyAggregates: [],
        completedAt: new Date(),
      };

      // Emit SIMULATION_COMPLETED event even on error
      try {
        void this.eventBus
          .emit("SIMULATION_COMPLETED", {
            type: "SIMULATION_COMPLETED",
            timestamp: new Date(),
            results: errorResults,
            durationMs: errorResults.simulationDurationMs,
            success: false,
            error: errorResults.error,
          })
          .catch((emitError) =>
            console.error(
              "Failed to emit SIMULATION_COMPLETED event:",
              emitError
            )
          );
      } catch (emitError) {
        console.error("Failed to emit SIMULATION_COMPLETED event:", emitError);
      }

      return errorResults;
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

    this.pendingDailyResults = new Array<DailyResult>(durationDays);

    // Emit SIMULATION_STARTED event
    void this.eventBus
      .emit("SIMULATION_STARTED", {
        type: "SIMULATION_STARTED",
        timestamp: new Date(),
        config: this.config,
        totalDays: durationDays,
        initialPlayerCount: this.config.initialPlayerCount,
      })
      .catch((error) =>
        console.error("Failed to emit SIMULATION_STARTED event:", error)
      );

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
        break;
      }

      // Use injected components instead of creating them
      await this.components.dayProcessor.processDay(
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
        newPlayers: this.dailyNewPlayers,
        playerCreation: {
          initialPlayers: this.dailyPlayerCreation.initialPlayers,
          growthPlayers: this.dailyPlayerCreation.growthPlayers,
          dauNewPlayers: this.dailyPlayerCreation.dauNewPlayers,
          reactivatedPlayers: this.dailyPlayerCreation.reactivatedPlayers,
        },
      };

      dailyResults.push(dailyResult);
      this.pendingDailyResults[day] = dailyResult;

      // Reset daily new players count for next day
      this.dailyNewPlayers = 0;
      this.dailyPlayerCreation = {
        initialPlayers: 0,
        growthPlayers: 0,
        dauNewPlayers: 0,
        reactivatedPlayers: 0,
      };

      // Report progress if enabled
      if (enableProgressReporting && progressCallback) {
        const progress = this.calculateProgress(day + 1, durationDays, elapsed);
        progressCallback(progress);
      }

      // Yield control to prevent UI blocking
      if (day % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      if (this.simulationAborted || cancellationToken?.cancelled) {
        break;
      }
    }

    // Generate final results
    const simulationDurationMs = performance.now() - this.startTime;

    const playerStats = this.getPlayerStatisticsFromState();
    const revenueStats = this.generateRevenueStatistics();
    const gameStats = this.generateGameStatistics();
    const matchingStats = this.components.gameMatchingEngine.getStatistics();

    const results: SimulationResults = {
      success: true,
      simulationDurationMs,
      config: this.config,
      summary: {
        totalDays: durationDays,
        totalPlayers: playerStats.totalPlayers,
        simulationCompleted:
          !this.simulationAborted && !cancellationToken?.cancelled,
      },
      playerStats,
      revenueStats,
      gameStats: {
        ...gameStats,
        resolvedGames: matchingStats.resolvedGames ?? 0,
        ...(matchingStats.gamesByLevelResolved
          ? { gamesByLevel: { ...matchingStats.gamesByLevelResolved } }
          : {}),
      },
      dailyResults,
      levelTrackingSnapshot: this.levelTrackingHandler.exportSnapshot(),
      completedAt: new Date(),
    };

    if (this.runtimeOptions.collectDailySnapshots) {
      results.dailyAggregates = generateDailyAggregates(
        results,
        results.levelTrackingSnapshot
      );
    }

    this.pendingDailyResults = [];

    if (this.simulationAborted || cancellationToken?.cancelled) {
      const completedDay = dailyResults.length;
      this.terminationState = {
        dayCompleted: completedDay,
        wasGraceful: cancellationToken?.cancelled === true ? false : true,
        reason:
          this.lastAbortReason ??
          (cancellationToken?.cancelled
            ? {
                code: "USER_CANCELLED",
                message: "Simulation cancelled via token",
              }
            : {
                code: "UNKNOWN",
                message: "Simulation terminated before completion",
              }),
      };
      results.termination = this.terminationState;
      results.success = false;
    }

    // Emit SIMULATION_COMPLETED event
    const completionEvent = {
      type: "SIMULATION_COMPLETED",
      timestamp: new Date(),
      results,
      durationMs: results.simulationDurationMs,
      success: true,
    };

    try {
      void this.eventBus
        .emit("SIMULATION_COMPLETED", completionEvent)
        .catch((error) =>
          console.error("Failed to emit SIMULATION_COMPLETED event:", error)
        );
    } catch (error) {
      console.error("Failed to emit SIMULATION_COMPLETED event:", error);
    }

    return results;
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
    // Prefer PlayerManager registry for accurate totals; fallback to pool
    const playerManager = this.components.playerManager as {
      getTotalPlayerCount?: () => number;
    };
    const totalFromRegistry = playerManager?.getTotalPlayerCount?.();
    if (typeof totalFromRegistry === "number" && totalFromRegistry > 0) {
      return totalFromRegistry;
    }
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
    // Get totals from PlayerManager when available
    const totalPlayers = this.getTotalPlayersFromRevenueCalc();
    const pm = this.components.playerManager as {
      getPlayerStatistics?: (config: any) => PlayerStatistics;
    };

    // Use PlayerManager's statistics which now includes DAU target
    const playerStats = pm?.getPlayerStatistics?.({} as any);
    const activePlayers = playerStats?.activePlayers ?? 0; // DAU target
    const retiredPlayers = Math.max(0, totalPlayers - activePlayers);

    // Get pool stats for progression funds
    const poolStats = this.components.gameMatchingEngine.getPoolStatistics();

    // Get financial data from RevenueCalculator (managed by RevenueTrackingHandler)
    const totalWinningsFunds =
      this.components.revenueCalculator.getPlayerWinnings();
    const totalCharityContributions =
      this.components.revenueCalculator.getCharityContributions();

    return {
      totalPlayers,
      activePlayers,
      retiredPlayers,
      completedRunsPlayers: playerStats?.completedRunsPlayers ?? 0,
      totalCharityContributions, // Duplicate of revenueStatistics.totalCharityContributions for player charts
      totalPlayerPayouts: totalWinningsFunds, // Duplicate of revenueStatistics.totalPlayerPayouts for player charts
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
    const totalCashOuts = revenueCalc.getTotalCashOuts();
    const cashOutCount = revenueCalc.getCashOutCount();
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
      totalCashOuts,
      cashOutCount,
    };
  }

  /**
   * Generate game statistics from event-driven state
   */
  private generateGameStatistics(): GameStatistics {
    const matchingStats = this.components.gameMatchingEngine.getStatistics();
    const totalGames =
      matchingStats.resolvedGames ??
      this.components.revenueCalculator.getTotalGames();
    const averageGamesPerDay =
      totalGames / Math.max(this.config.durationDays, 1);

    const poolStats = this.components.gameMatchingEngine.getPoolStatistics();
    const pooledVirtualDollars = poolStats.totalDollarsInPool;
    const totalRunsCreated = this.runMetrics.totalRunsCreated;

    // In event-driven architecture, we don't have direct access to completed runs
    // This would be tracked via RUN_COMPLETED events in a proper implementation
    return {
      totalGames,
      averageGamesPerDay,
      pooledVirtualDollars,
      totalVirtualDollars: pooledVirtualDollars, // Total virtual dollars matches pooled amount
      totalRunsCreated,
      completedRuns: 0, // Completed runs not directly tracked
      activeRuns: pooledVirtualDollars, // Active runs equal pooled virtual dollars
      jackpotsWon: 0, // Jackpots not tracked in this implementation
      averageRunLength: 0, // Average run length not directly calculable
      resolvedGames: matchingStats.resolvedGames ?? 0,
      gamesByLevel:
        matchingStats.gamesByLevelResolved ?? this.createEmptyGamesByLevel(),
      peakPoolSize: pooledVirtualDollars,
    };
  }

  /**
   * Get empty player statistics object
   */
  private getEmptyPlayerStats(): PlayerStatistics {
    return {
      totalPlayers: 0,
      activePlayers: 0,
      retiredPlayers: 0,
      completedRunsPlayers: 0,
      totalCharityContributions: 0,
      totalPlayerPayouts: 0,
      totalProgressionFunds: 0,
      averageGamesPerPlayer: 0,
      playerRetirementRate: 0,
    };
  }

  /**
   * Get empty revenue statistics object
   */
  private getEmptyRevenueStats(): RevenueStatistics {
    return {
      totalPlatformRevenue: 0,
      totalCharityContributions: 0,
      totalPlayerPayouts: 0,
      revenuePerGame: 0,
      charityPercentage: 0,
      averageRevenuePerDay: 0,
      totalCashOuts: 0,
      cashOutCount: 0,
    };
  }

  /**
   * Get empty game statistics object
   */
  private getEmptyGameStats(): GameStatistics {
    return {
      totalGames: 0,
      averageGamesPerDay: 0,
      pooledVirtualDollars: 0,
      totalVirtualDollars: 0,
      totalRunsCreated: 0,
      completedRuns: 0,
      activeRuns: 0,
      jackpotsWon: 0,
      averageRunLength: 0,
      resolvedGames: 0,
      gamesByLevel: this.createEmptyGamesByLevel(),
    };
  }

  /**
   * Get empty games by level object
   */
  private createEmptyGamesByLevel(): Record<BettingLevel, number> {
    return {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
    };
  }

  /**
   * Normalize simulation configuration or profile input
   */
  private normalizeSimulationInput(
    configOrProfile: SimulationConfig | SimulationProfile
  ): {
    config: SimulationConfig;
    runtime: SimulationRuntimeOptions;
    profileName?: string | undefined;
  } {
    let config: SimulationConfig;
    let profileName: string | undefined;
    let runtime: SimulationRuntimeOptions = {
      ...DEFAULT_RUNTIME_OPTIONS,
    };

    if (isSimulationProfile(configOrProfile)) {
      // Input is a simulation profile
      profileName = configOrProfile.name;
      config = configOrProfile.config;
      runtime = {
        ...runtime,
        ...configOrProfile.runtime,
      };
    } else {
      // Input is a raw configuration object
      config = configOrProfile;
    }

    // Apply default runtime options
    runtime = {
      ...DEFAULT_RUNTIME_OPTIONS,
      ...runtime,
    };

    return { config, runtime, profileName: profileName || undefined };
  }

  /**
   * Create strategy manager for player strategies
   */
  private createStrategyManager(): IStrategyManager {
    return {
      getPlayerStrategy: (playerId: string) => {
        // Use the actual PlayerManager's strategy assignment
        return this.components.playerManager.getPlayerStrategy(playerId);
      },
      makeCashOutDecision: () => "CONTINUE",
      getCashOutProbability: () => 0.5,
      processDecision: (context: DecisionProcessContext) => {
        if (context.decision === "CASH_OUT") {
          // Get the virtual dollar's current winnings
          const currentWinnings =
            this.components.playerManager.getVirtualDollarCurrentWinnings(
              context.virtualDollarId
            );
          return {
            finalLevel: context.currentLevel,
            totalWinnings: context.totalWinnings,
            cashOutAmount: currentWinnings,
            completed: true,
          };
        }
        return {
          finalLevel: context.currentLevel,
          totalWinnings: context.totalWinnings,
          cashOutAmount: 0,
          completed: false,
        };
      },
    };
  }

  /**
   * Get the current runtime options
   */
  getRuntimeOptions(): SimulationRuntimeOptions {
    return { ...this.runtimeOptions };
  }

  /**
   * Get the active profile name
   */
  getActiveProfileName(): string {
    return DEFAULT_SIMULATION_PROFILE_NAME;
  }

  /**
   * Dispose of the simulator and clean up resources
   */
  dispose(): void {
    // Unsubscribe from all event subscriptions
    if (this.runCreatedSubscription) {
      this.runCreatedSubscription.unsubscribe();
      this.runCreatedSubscription = null;
    }
    if (this.dayCompletedSubscription) {
      this.dayCompletedSubscription.unsubscribe();
      this.dayCompletedSubscription = null;
    }
    if (this.dayFrameCompletedSubscription) {
      this.dayFrameCompletedSubscription.unsubscribe();
      this.dayFrameCompletedSubscription = null;
    }

    // Dispose of event handlers
    this.eventHandlers.forEach((handler) => {
      if (typeof handler.dispose === "function") {
        handler.dispose();
      }
    });
    this.eventHandlers = [];
  }
}
