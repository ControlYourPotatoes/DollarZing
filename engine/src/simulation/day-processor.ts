import { GameMatchingEngine } from "../core/game-matching-engine";
import { PlayerManager } from "./player-manager";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { DollarState } from "../types/virtual-dollar-engine";
import { EventBus, type EventSubscription } from "../events/event-bus";
import {
  EVENT_TYPES,
  DayStartedEvent,
  DayCompletedEvent,
  DayFrameCompletedEvent,
  NewRunCreatedEvent,
  RevenueUpdateEvent,
} from "../events/event-types";
import { SimulationConfig } from "./game-engine-simulator";
import { progression } from "../utils/progression-logger";
import type { EventDebugInterface } from "../events/debug";

/**
 * Configuration for daily processing
 */
export interface DayProcessingConfig {
  initialPlayerCount: number;
  maxGamesPerDay: number;
  dailySeed: string;
}

/**
 * DayProcessor handles the daily simulation processing logic
 * Extracted from SimulationController to provide focused daily operations
 */
export class DayProcessor {
  constructor(
    private gameMatchingEngine: GameMatchingEngine,
    private playerManager: PlayerManager,
    private dollarManager: VirtualDollarFactory,
    private eventBus: EventBus,
    options?: {
      loggingEnabled?: boolean;
      durationDays?: number;
    },
    private debugInterface?: EventDebugInterface,
    private verbose?: boolean
  ) {
    this.loggingEnabled = options?.loggingEnabled ?? false;
    this.durationDays = options?.durationDays ?? 1;
    this.setupEventSubscriptions();
    // Suppress unused variable warning - verbose parameter kept for consistency
    void this.verbose;
  }

  private loggingEnabled: boolean;
  private newRunSubscription: EventSubscription | null = null;
  private durationDays: number;
  private totalRevenue: number = 0;

  setLoggingEnabled(enabled: boolean): void {
    this.loggingEnabled = enabled;
  }

  /**
   * Setup event subscriptions for event-driven processing
   */
  private setupEventSubscriptions(): void {
    this.newRunSubscription = this.eventBus.on(
      EVENT_TYPES.NEW_RUN_CREATED,
      this.handleNewRunCreated.bind(this)
    );

    // Subscribe to DAY_FRAME_COMPLETED for accurate end-of-day progression logging
    this.eventBus.on(
      EVENT_TYPES.DAY_FRAME_COMPLETED,
      (event: DayFrameCompletedEvent) => {
        // Log progression at frame completion for accurate summaries
        progression.dayEnded(event.dayNumber, this.durationDays, {
          gamesProcessed: event.summary.gamesProcessed,
          newPlayers: event.summary.newPlayers,
          poolSize: event.summary.poolSize,
          totalRevenue: this.totalRevenue,
        });
      }
    );

    // Subscribe to REVENUE_UPDATE to track total revenue
    this.eventBus.on(
      EVENT_TYPES.REVENUE_UPDATE,
      (event: RevenueUpdateEvent) => {
        this.totalRevenue = event.totalPlatformRevenue;
      }
    );
  }

  /**
   * Handle new run created event - add to pool
   */
  private async handleNewRunCreated(event: NewRunCreatedEvent): Promise<void> {
    const virtualDollar = this.dollarManager.getDollar(event.virtualDollarId);
    if (!virtualDollar) {
      console.warn(
        `[DayProcessor] Ignoring NEW_RUN_CREATED for missing dollar ${event.virtualDollarId}`
      );
      return;
    }

    if (virtualDollar.state !== DollarState.POOLED) {
      this.dollarManager.updateDollarState(
        event.virtualDollarId,
        DollarState.POOLED
      );
    }

    void this.gameMatchingEngine
      .addToPool(virtualDollar)
      .catch((error) =>
        console.warn(
          `[DayProcessor] Failed to add dollar ${event.virtualDollarId
          } to pool: ${error instanceof Error ? error.message : String(error)}`
        )
      );
  }

  dispose(): void {
    this.newRunSubscription?.unsubscribe();
    this.newRunSubscription = null;
  }

  /**
   * Process a single day of simulation
   * DayProcessor handles the daily simulation logic while GameEngineSimulator orchestrates
   */
  async processDay(
    day: number,
    config: DayProcessingConfig,
    simulationConfig: SimulationConfig
  ): Promise<void> {
    if (this.debugInterface) {
      console.log(`DEBUG: [DayProcessor] ===== PROCESSING DAY ${day} =====`);
    }

    // Emit day started event using 1-based day numbering
    const eventDay = day + 1;
    const initialPoolStats = this.gameMatchingEngine.getPoolStatistics();
    void this.eventBus.emit(EVENT_TYPES.DAY_STARTED, {
      type: EVENT_TYPES.DAY_STARTED,
      timestamp: new Date(),
      dayNumber: eventDay,
      totalPlayers: 0, // Will need to track this properly
      activePlayers: 0, // Will need to track this properly
      poolSize: initialPoolStats.totalDollarsInPool,
      growthModel: simulationConfig.growthModel,
      playerStrategies: simulationConfig.playerStrategies,
    } as DayStartedEvent);

    // Log progression for CLI feedback
    progression.dayStarted(eventDay, simulationConfig.durationDays);

    // Note: addNewRunsToPool() is now handled by PlayerManager via DAY_STARTED event

    // Process available games for the day
    const maxGamesPerDay = Math.max(25, config.initialPlayerCount * 2);

    const poolStats = this.gameMatchingEngine.getPoolStatistics();
    if (this.debugInterface) {
      console.log(
        `DEBUG: Day ${day} - Pool stats - Total: ${poolStats.totalDollarsInPool}, Available: ${poolStats.availableForMatching}`
      );
    }

    // Event-driven architecture: MatchmakingEventHandler will automatically
    // attempt matchmaking when POOL_ADDED and POOL_UPDATED events are emitted
    // The daily loop is no longer needed as matchmaking happens reactively

    if (this.debugInterface) {
      console.log(
        `DEBUG: Day ${day} - Matchmaking will be handled by MatchmakingEventHandler through events`
      );
    }

    // Small delay to allow event processing
    await new Promise((resolve) => setTimeout(resolve, 500)); // Increased from 10ms to allow async event chains to complete

    // Wait for all async event processing to complete before ending the day
    // This ensures matchmaking, game resolution, and cash-outs all finish
    await this.waitForEventProcessing();

    // Wait for event processing to complete
    // Keep checking until no new games are being resolved and system is stable
    let lastResolvedCount =
      this.gameMatchingEngine.getStatistics().resolvedGames ?? 0;
    let lastActiveCount = this.gameMatchingEngine.getActiveGamesCount();
    let lastPoolSize =
      this.gameMatchingEngine.getPoolStatistics().totalDollarsInPool;
    let stableCount = 0;
    const maxWaitMs = 30000; // Increased from 15 to 30 seconds for large simulations
    const requiredStablePolls = 5; // Increased from 3 to 5 for more confidence
    const startWait = Date.now();

    while (stableCount < requiredStablePolls && Date.now() - startWait < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = this.gameMatchingEngine.getStatistics();
      const currentResolvedCount = stats.resolvedGames ?? 0;
      const currentActiveCount = this.gameMatchingEngine.getActiveGamesCount();
      const poolStatsSnapshot = this.gameMatchingEngine.getPoolStatistics();
      const currentPoolSize = poolStatsSnapshot.totalDollarsInPool;

      const resolvedMonotonic = currentResolvedCount >= lastResolvedCount;
      const activeNonIncreasing = currentActiveCount <= lastActiveCount;
      const poolStable = Math.abs(currentPoolSize - lastPoolSize) <= Math.max(5, Math.floor(lastPoolSize * 0.02)); // Allow 2% variation or min 5

      if (resolvedMonotonic && activeNonIncreasing && poolStable) {
        stableCount++;
      } else {
        stableCount = 0;
        if (this.debugInterface) {
          console.log(
            `DEBUG: Day ${day} stability reset -> resolved: ${currentResolvedCount} (prev ${lastResolvedCount}), active: ${currentActiveCount} (prev ${lastActiveCount}), pool: ${currentPoolSize} (prev ${lastPoolSize})`
          );
        }
      }

      lastResolvedCount = currentResolvedCount;
      lastActiveCount = currentActiveCount;
      lastPoolSize = currentPoolSize;
    }

    if (Date.now() - startWait >= maxWaitMs && this.debugInterface) {
      const stats = this.gameMatchingEngine.getStatistics();
      const poolStatsSnapshot = this.gameMatchingEngine.getPoolStatistics();
      console.warn(
        `WARN: Day ${day} stabilization timeout after ${Date.now() - startWait}ms -> resolved=${stats.resolvedGames}, active=${this.gameMatchingEngine.getActiveGamesCount()}, pool=${poolStatsSnapshot.totalDollarsInPool}`
      );
    }

    // Emit day completed event
    const finalPoolStats = this.gameMatchingEngine.getPoolStatistics();
    const dailyNewPlayers = this.playerManager.getDailyNewPlayersCount();
    const completedPayload: DayCompletedEvent = {
      type: EVENT_TYPES.DAY_COMPLETED,
      timestamp: new Date(),
      dayNumber: eventDay,
      gamesProcessed: maxGamesPerDay, // Approximate
      newPlayers: dailyNewPlayers, // Track new players added today
      totalRevenue: 0, // Would need to track this through revenue events
      poolSize: finalPoolStats.totalDollarsInPool,
      activePlayers: 0, // Would need to track this properly
    };

    void this.eventBus.emit(EVENT_TYPES.DAY_COMPLETED, completedPayload);

    // Emit day frame completed event for handler state reset
    void this.eventBus.emit(EVENT_TYPES.DAY_FRAME_COMPLETED, {
      type: EVENT_TYPES.DAY_FRAME_COMPLETED,
      timestamp: new Date(),
      dayNumber: eventDay,
      summary: {
        gamesProcessed: lastResolvedCount, // Use actual resolved games count
        newPlayers: completedPayload.newPlayers,
        poolSize: completedPayload.poolSize,
        activePlayers: completedPayload.activePlayers,
      },
    } as DayFrameCompletedEvent);

    // Log progression for CLI feedback
    progression.dayEnded(eventDay, simulationConfig.durationDays, {
      gamesProcessed: lastResolvedCount, // Use actual resolved games count
      newPlayers: completedPayload.newPlayers,
      poolSize: completedPayload.poolSize,
    });

    // Additional progression logs for detailed tracking
    progression.playerGrowth(
      eventDay,
      0, // activePlayers - would need to track this
      dailyNewPlayers,
      0 // eliminatedPlayers - would need to track this
    );

    progression.gamesCompleted(
      eventDay,
      lastResolvedCount, // Use actual resolved games count
      0 // totalGames - would need to track this across days
    );
  }

  /**
   * Wait for all pending async events to complete
   * This ensures all matchmaking, game resolution, and cash-out events are processed
   * before capturing the daily stats and moving to the next day
   */
  private async waitForEventProcessing(): Promise<void> {
    const pollIntervalMs = 100;
    const startTime = Date.now();

    let lastPoolSize = -1;
    let lastActiveGames = -1;
    let stableCount = 0;
    const requiredStablePolls = 5; // Need 5 consecutive stable polls (500ms total)

    while (true) {
      const poolStats = this.gameMatchingEngine.getPoolStatistics();
      const activeGames = this.gameMatchingEngine.getActiveGameCount();
      const poolSize = poolStats.totalDollarsInPool;

      // Check if state is stable (no active games, pool not changing)
      if (
        activeGames === 0 &&
        poolSize === lastPoolSize &&
        activeGames === lastActiveGames
      ) {
        stableCount++;
        if (stableCount >= requiredStablePolls) {
          const elapsed = Date.now() - startTime;
          if (this.debugInterface) {
            console.log(
              `[DayProcessor] Event processing complete after ${elapsed}ms - pool stable at ${poolSize}, no active games`
            );
          }
          return;
        }
      } else {
        stableCount = 0;
      }

      lastPoolSize = poolSize;
      lastActiveGames = activeGames;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * Add new runs to the game matching engine pool
   * DEPRECATED: This method is now deprecated in favor of event-driven approach
   * New run creation is now handled by:
   * 1. DayProcessor emits DAY_STARTED event
   * 2. PlayerManager listens to DAY_STARTED and creates new runs
   * 3. PlayerManager emits NEW_RUN_CREATED events
   * 4. DayProcessor.handleNewRunCreated() adds runs to pool
   */
  async addNewRunsToPool(): Promise<void> {
    if (this.loggingEnabled) {
      console.warn(
        `DEBUG: addNewRunsToPool called - this is deprecated in favor of event-driven approach`
      );
      console.warn(
        `DEBUG: New runs should be created by PlayerManager listening to DAY_STARTED events`
      );
    }
    // Deprecated - new runs are now handled via DAY_STARTED → PlayerManager → NEW_RUN_CREATED events
  }

  /**
   * Resolve games to determine winners and losers
   * NOTE: This method is deprecated in favor of event-driven approach
   * Game resolution is now handled by the GameMatchingEngine directly
   */
  async resolveGames(_games: any[], _dailySeed: string): Promise<void> {
    if (this.loggingEnabled) {
      console.warn(
        `DEBUG: resolveGames called - this method is deprecated in favor of event-driven approach`
      );
    }
    // Game resolution is now handled by the GameMatchingEngine directly
    // and results are processed through GAME_RESOLVED events
  }
}
