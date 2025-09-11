import { PlayerBalanceManager } from "../types/player-balance-manager";
import { PlayerRunManager } from "../types/player-run-manager";
import {
  CashOutStrategy,
  VirtualDollar,
  GameResult,
} from "../types/virtual-dollar-engine";
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
 * Extracted from SimulationController to provide focused player management
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
    }
  >();

  constructor(
    private playerBalanceManager: PlayerBalanceManager,
    private runOrchestrator: PlayerRunManager,
    private eventBus: EventBus
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
    const currentPlayerCount = this.runOrchestrator.getActivePlayerCount();

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

        // Create initial run for new player
        const newRun = this.runOrchestrator.createNewRun({
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
    const newRuns = this.runOrchestrator.autoCreateRuns(2); // Max 2 concurrent runs per player

    // Emit NEW_RUN_CREATED events for auto-created runs
    for (const run of newRuns) {
      const playerStrategy = this.runOrchestrator.getPlayerStrategy(
        run.ownerId
      );
      await this.eventBus.emit(EVENT_TYPES.NEW_RUN_CREATED, {
        type: EVENT_TYPES.NEW_RUN_CREATED,
        timestamp: new Date(),
        playerId: run.ownerId,
        virtualDollarId: run.id,
        fundingSource: "DONATION",
        cashOutStrategy: playerStrategy,
        runCount: 1, // This would need to be tracked properly
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
  initializePlayers(config: PlayerManagementConfig): number {
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
   */
  getPlayerStatistics(_config: PlayerManagementConfig): PlayerStatistics {
    const totalDonationFunds = this.playerBalanceManager.getTotalDonations();
    const totalWinningsFunds = this.playerBalanceManager.getTotalWinnings();

    // Use player registry for accurate player counts
    const totalPlayers = this.playerRegistry.size;
    const activePlayers = this.runOrchestrator.getActivePlayerCount();
    const retiredPlayers = totalPlayers - activePlayers;

    // Calculate total progression funds from active runs
    const activeRuns = this.runOrchestrator.getAllActiveRuns();
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
      totalDonationsFunds: totalDonationFunds,
      totalWinningsFunds: totalWinningsFunds,
      totalProgressionFunds: totalProgressionFunds,
      averageGamesPerPlayer: 0, // Will be calculated by caller with game data
      playerRetirementRate: retiredPlayers / totalPlayers,
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
    // Fallback to run orchestrator if not in registry
    return this.runOrchestrator.getPlayerStrategy(playerId);
  }

  /**
   * Create new run
   */
  createNewRun(request: any): VirtualDollar | null {
    return this.runOrchestrator.createNewRun(request);
  }

  /**
   * Auto-create runs
   */
  autoCreateRuns(maxRunsPerPlayer: number = 1): VirtualDollar[] {
    return this.runOrchestrator.autoCreateRuns(maxRunsPerPlayer);
  }
}
