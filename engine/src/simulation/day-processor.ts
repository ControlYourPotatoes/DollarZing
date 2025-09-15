import { GameMatchingEngine } from "../core/game-matching-engine";
import { PlayerManager } from "./player-manager";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { PooledVirtualDollarFactory } from "../factories";
import { DollarState } from "../types/virtual-dollar-engine";
import { EventBus } from "../events/event-bus";
import {
  EVENT_TYPES,
  DayStartedEvent,
  DayCompletedEvent,
  NewRunCreatedEvent,
} from "../events/event-types";
import { SimulationConfig } from "./game-engine-simulator";

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
    private dollarManager: PooledVirtualDollarFactory,
    private eventBus: EventBus
  ) {
    this.setupEventSubscriptions();
    // Suppress unused variable warning - playerManager is kept for future use
    void this.playerManager;
  }

  /**
   * Setup event subscriptions for event-driven processing
   */
  private setupEventSubscriptions(): void {
    this.eventBus.on(
      EVENT_TYPES.NEW_RUN_CREATED,
      this.handleNewRunCreated.bind(this)
    );
  }

  /**
   * Handle new run created event - add to pool
   */
  private async handleNewRunCreated(event: NewRunCreatedEvent): Promise<void> {
    // Add the new run to the game matching engine pool
    this.dollarManager.updateDollarState(
      event.virtualDollarId,
      DollarState.POOLED
    );

    // Get the virtual dollar from the manager
    const virtualDollar = this.dollarManager.getDollar(event.virtualDollarId);
    if (virtualDollar) {
      this.gameMatchingEngine.addToPool(virtualDollar);
    }
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
    console.log(`DEBUG: [DayProcessor] ===== PROCESSING DAY ${day} =====`);

    // Emit day started event
    const initialPoolStats = this.gameMatchingEngine.getPoolStatistics();
    await this.eventBus.emit(EVENT_TYPES.DAY_STARTED, {
      type: EVENT_TYPES.DAY_STARTED,
      timestamp: new Date(),
      dayNumber: day,
      totalPlayers: 0, // Will need to track this properly
      activePlayers: 0, // Will need to track this properly
      poolSize: initialPoolStats.totalDollarsInPool,
      growthModel: simulationConfig.growthModel,
      playerStrategies: simulationConfig.playerStrategies,
    } as DayStartedEvent);
    // Note: addNewRunsToPool() is now handled by PlayerManager via DAY_STARTED event

    // Process available games for the day
    const maxGamesPerDay = Math.max(25, config.initialPlayerCount * 2);

    const poolStats = this.gameMatchingEngine.getPoolStatistics();
    console.log(
      `DEBUG: Day ${day} - Pool stats - Total: ${poolStats.totalDollarsInPool}, Available: ${poolStats.availableForMatching}`
    );

    // Event-driven architecture: MatchmakingEventHandler will automatically
    // attempt matchmaking when POOL_ADDED and POOL_UPDATED events are emitted
    // The daily loop is no longer needed as matchmaking happens reactively
    
    console.log(
      `DEBUG: Day ${day} - Matchmaking will be handled by MatchmakingEventHandler through events`
    );
    
    // Small delay to allow event processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Emit day completed event
    const finalPoolStats = this.gameMatchingEngine.getPoolStatistics();
    await this.eventBus.emit(EVENT_TYPES.DAY_COMPLETED, {
      type: EVENT_TYPES.DAY_COMPLETED,
      timestamp: new Date(),
      dayNumber: day,
      gamesProcessed: maxGamesPerDay, // Approximate
      newPlayers: 0, // Would need to track this
      totalRevenue: 0, // Would need to track this through revenue events
      poolSize: finalPoolStats.totalDollarsInPool,
      activePlayers: 0, // Would need to track this properly
    } as DayCompletedEvent);
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
    console.warn(
      `DEBUG: addNewRunsToPool called - this is deprecated in favor of event-driven approach`
    );
    console.warn(
      `DEBUG: New runs should be created by PlayerManager listening to DAY_STARTED events`
    );
    // Deprecated - new runs are now handled via DAY_STARTED → PlayerManager → NEW_RUN_CREATED events
  }

  /**
   * Resolve games to determine winners and losers
   * NOTE: This method is deprecated in favor of event-driven approach
   * Game resolution is now handled by the GameMatchingEngine directly
   */
  async resolveGames(_games: any[], _dailySeed: string): Promise<void> {
    console.warn(
      `DEBUG: resolveGames called - this method is deprecated in favor of event-driven approach`
    );
    // Game resolution is now handled by the GameMatchingEngine directly
    // and results are processed through GAME_RESOLVED events
  }
}
