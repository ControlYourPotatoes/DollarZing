import {
  CashOutStrategy,
  VirtualDollar,
} from "../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { EventBus } from "../events/event-bus";
import {
  EVENT_TYPES,
  DayStartedEvent,
  PlayerCreatedEvent,
  NewRunCreatedEvent,
} from "../events/event-types";

/**
 * Configuration for player management
 */
export interface PlayerManagementConfig {
  initialPlayerCount: number;
  initialDonationAmount: number;
  playerStrategies: Partial<Record<CashOutStrategy, number>>;
}

/**
 * Player statistics interface
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
 * PlayerManager handles player lifecycle and initialization
 * Event-driven component that manages players and virtual dollar runs
 * Removed legacy dependencies on PlayerBalanceManager and PlayerRunManager
 */
export class PlayerManager {
  // Single player registry to avoid duplicate state management
  private playerRegistry = new Map<
    string,
    {
      id: string;
      strategy: CashOutStrategy;
      initialDonation: number;
      createdAt: Date;
      activeRunIds: string[]; // Track active virtual dollar runs
      totalRunsCreated: number;
    }
  >();

  constructor(
    private eventBus: EventBus,
    private virtualDollarFactory: VirtualDollarFactory
  ) {
    this.setupEventSubscriptions();
  }

  /**
   * Setup event subscriptions for event-driven processing
   */
  private setupEventSubscriptions(): void {
    this.eventBus.on<DayStartedEvent>(
      EVENT_TYPES.DAY_STARTED,
      this.handleDayStarted.bind(this),
      10 // High priority
    );
  }

  /**
   * Handle day started event - create new players and runs based on growth model
   */
  private async handleDayStarted(event: DayStartedEvent): Promise<void> {
    const { dayNumber, growthModel, playerStrategies } = event;

    // Use S-curve growth model from event
    const x =
      (dayNumber - growthModel.midpointDay) / growthModel.steepnessFactor;
    const adoptionProgress = 1 / (1 + Math.exp(-x));
    const targetPlayers = Math.floor(
      growthModel.baseMarket * growthModel.adoptionRate * adoptionProgress
    );

    // Calculate current player count
    const currentPlayerCount = this.getActivePlayerCount();

    // Add new players if we're below target
    const playersToAdd = Math.max(0, targetPlayers - currentPlayerCount);
    const dailyNewPlayers = Math.min(
      playersToAdd,
      Math.max(1, Math.ceil(playersToAdd * 0.2))
    ); // Up to 20% of gap per day

    if (dailyNewPlayers > 0) {
      console.log(
        `DEBUG: Day ${dayNumber}, Adding ${dailyNewPlayers} new players via event-driven growth`
      );

      for (let i = 0; i < dailyNewPlayers; i++) {
        const playerId = `player-new-${dayNumber}-${i}`;

        // Assign random strategy based on distribution from event
        const strategies = Object.keys(playerStrategies) as CashOutStrategy[];
        const strategyWeights = Object.values(playerStrategies);
        const randomValue = Math.random();
        let cumulativeWeight = 0;
        let selectedStrategy: CashOutStrategy = CashOutStrategy.BALANCED;

        for (let j = 0; j < strategies.length; j++) {
          cumulativeWeight += strategyWeights[j];
          if (randomValue <= cumulativeWeight) {
            selectedStrategy = strategies[j];
            break;
          }
        }

        // Register player in single registry (no duplicate state management)
        this.playerRegistry.set(playerId, {
          id: playerId,
          strategy: selectedStrategy,
          initialDonation: 100,
          createdAt: new Date(),
          activeRunIds: [],
          totalRunsCreated: 0,
        });

        // Emit PLAYER_CREATED event
        await this.eventBus.emit(EVENT_TYPES.PLAYER_CREATED, {
          type: EVENT_TYPES.PLAYER_CREATED,
          timestamp: new Date(),
          playerId,
          initialDonationAmount: 100,
          cashOutStrategy: selectedStrategy,
          isNewPlayer: true,
        } as PlayerCreatedEvent);

        // Create initial run for new player using VirtualDollarFactory
        const newRun = this.createNewRun({
          playerId,
          cashOutStrategy: selectedStrategy,
          fundingSource: "DONATION",
        });

        if (newRun) {
          // Emit NEW_RUN_CREATED event
          await this.eventBus.emit(EVENT_TYPES.NEW_RUN_CREATED, {
            type: EVENT_TYPES.NEW_RUN_CREATED,
            timestamp: new Date(),
            playerId,
            virtualDollarId: newRun.id,
            fundingSource: "DONATION",
            cashOutStrategy: selectedStrategy,
            runCount: 1,
          } as NewRunCreatedEvent);
        }
      }
    }

    // Auto-create runs for existing players
    const newRuns = this.autoCreateRuns(2); // Max 2 concurrent runs per player

    // Emit NEW_RUN_CREATED events for auto-created runs
    for (const run of newRuns) {
      const playerStrategy = this.getPlayerStrategy(run.ownerId);
      const player = this.playerRegistry.get(run.ownerId);

      await this.eventBus.emit(EVENT_TYPES.NEW_RUN_CREATED, {
        type: EVENT_TYPES.NEW_RUN_CREATED,
        timestamp: new Date(),
        playerId: run.ownerId,
        virtualDollarId: run.id,
        fundingSource: "DONATION",
        cashOutStrategy: playerStrategy,
        runCount: player ? player.totalRunsCreated : 1,
      } as NewRunCreatedEvent);
    }
  }

  /**
   * Initialize players with starting donation balance
   * DEPRECATED: This method bypasses event-driven architecture
   * 
   * In pure event-driven architecture, initial players should be created by:
   * 1. GameEngineSimulator emitting initialization events
   * 2. PlayerManager.handleDayStarted() creating players via growth model
   * 
   * This method is kept temporarily for backward compatibility
   */
  initializePlayers(_config: PlayerManagementConfig): number {
    console.warn(
      `[PlayerManager] initializePlayers called - this method bypasses event-driven architecture`
    );
    console.warn(
      `[PlayerManager] Consider using DAY_STARTED events with growth model to create initial players`
    );
    
    // Deprecated implementation - should be replaced with event-driven approach
    return 0; // Return 0 to indicate no players created via this deprecated path
  }

  /**
   * Add new players based on growth model
   * NOTE: This method is now deprecated in favor of event-driven approach via handleDayStarted
   * Kept for backward compatibility but should not be used in new event-driven architecture
   */
  addNewPlayersForDay(day: number, _config: PlayerManagementConfig): void {
    console.warn(
      `DEBUG: addNewPlayersForDay called for day ${day} - this method is deprecated in favor of event-driven approach`
    );
    // This method is now handled by the handleDayStarted event handler
    // which uses the growth model parameters from the DAY_STARTED event
  }

  /**
   * Generate player statistics
   * NOTE: Financial data now handled by RevenueTrackingHandler via events
   */
  getPlayerStatistics(_config: PlayerManagementConfig): PlayerStatistics {
    // Use player registry for accurate player counts
    const totalPlayers = this.playerRegistry.size;
    const activePlayers = this.getActivePlayerCount();
    const retiredPlayers = totalPlayers - activePlayers;

    // Calculate total progression funds from active runs
    const activeRuns = this.getAllActiveRuns();
    const totalProgressionFunds = activeRuns.reduce(
      (sum: number, dollar: VirtualDollar) => {
        return sum + dollar.currentRunWinnings;
      },
      0
    );

    return {
      totalPlayers,
      activePlayers,
      retiredPlayers,
      totalDonationsFunds: 0, // Now handled by RevenueTrackingHandler
      totalWinningsFunds: 0, // Now handled by RevenueTrackingHandler
      totalProgressionFunds: totalProgressionFunds,
      averageGamesPerPlayer: 0, // Will be calculated by caller with game data
      playerRetirementRate: totalPlayers > 0 ? retiredPlayers / totalPlayers : 0,
    };
  }

  /**
   * Process a game result with proper cash-out logic
   * NOTE: This method is now deprecated in favor of event-driven approach
   * Game processing should now be handled by:
   * - GameEventHandler → emits GAME_RESOLVED events
   * - PlayerProgressionHandler → handles progression
   * - CashOutDecisionHandler → handles cash-out decisions
   */
  

  /**
   * Get player strategy from registry
   */
  getPlayerStrategy(playerId: string): CashOutStrategy {
    const player = this.playerRegistry.get(playerId);
    if (player) {
      return player.strategy;
    }
    // Fallback to default strategy if not in registry
    return CashOutStrategy.BALANCED;
  }

  /**
   * Get the number of active players (players with active runs)
   */
  getActivePlayerCount(): number {
    let activeCount = 0;
    for (const player of this.playerRegistry.values()) {
      if (player.activeRunIds.length > 0) {
        activeCount++;
      }
    }
    return activeCount;
  }

  /**
   * Get all active runs across all players
   */
  getAllActiveRuns(): VirtualDollar[] {
    const activeRuns: VirtualDollar[] = [];

    for (const player of this.playerRegistry.values()) {
      for (const runId of player.activeRunIds) {
        const dollar = this.virtualDollarFactory.getDollar(runId);
        if (dollar) {
          activeRuns.push(dollar);
        }
      }
    }

    return activeRuns;
  }

  /**
   * Create new run for a player using VirtualDollarFactory
   */
  createNewRun(request: {
    playerId: string;
    cashOutStrategy: CashOutStrategy;
    fundingSource: "DONATION" | "WINNINGS";
  }): VirtualDollar | null {
    try {
      // Create virtual dollar using factory
      const virtualDollar = this.virtualDollarFactory.create(request.playerId);

      // Update player registry to track this run
      const player = this.playerRegistry.get(request.playerId);
      if (player) {
        player.activeRunIds.push(virtualDollar.id);
        player.totalRunsCreated++;
      }

      return virtualDollar;
    } catch (error) {
      console.error(`Failed to create new run for player ${request.playerId}:`, error);
      return null;
    }
  }

  /**
   * Auto-create runs for eligible players (those with fewer than maxRunsPerPlayer)
   */
  autoCreateRuns(maxRunsPerPlayer: number = 1): VirtualDollar[] {
    const newRuns: VirtualDollar[] = [];

    for (const player of this.playerRegistry.values()) {
      // Create runs for players with fewer than max concurrent runs
      const runsNeeded = Math.max(0, maxRunsPerPlayer - player.activeRunIds.length);

      for (let i = 0; i < runsNeeded; i++) {
        const newRun = this.createNewRun({
          playerId: player.id,
          cashOutStrategy: player.strategy,
          fundingSource: "DONATION",
        });

        if (newRun) {
          newRuns.push(newRun);
        }
      }
    }

    return newRuns;
  }

  /**
   * Remove a run from player's active runs (called when run completes)
   */
  removeActiveRun(playerId: string, virtualDollarId: string): void {
    const player = this.playerRegistry.get(playerId);
    if (player) {
      const index = player.activeRunIds.indexOf(virtualDollarId);
      if (index > -1) {
        player.activeRunIds.splice(index, 1);
      }
    }
  }
}
