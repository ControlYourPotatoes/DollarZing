import { CashOutStrategy, VirtualDollar } from "../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { EventBus, type EventSubscription } from "../events/event-bus";
import {
  EVENT_TYPES,
  DayStartedEvent,
  DayFrameCompletedEvent,
  PlayerCreatedEvent,
  CashOutCompletedEvent,
} from "../events/event-types";
import { PlayerCreationManager } from "./player-creation-manager";
import { DormantPlayerStore } from "./player-registry";
import type { PoolStatistics } from "../core/game-matching-engine";

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
    private virtualDollarFactory: VirtualDollarFactory,
    private dormantStore: DormantPlayerStore,
    private poolSnapshotProvider: () => Pick<
      PoolStatistics,
      "totalDollarsInPool" | "availableForMatching" | "dollarsInGame"
    > | null = () => null
  ) {
    this.setupEventSubscriptions();
    this.playerCreationManager = new PlayerCreationManager(
      eventBus,
      virtualDollarFactory,
      {
        initialPlayerSpreadDays: 14,
        maxNewPlayersPerDay: PlayerManager.MAX_NEW_PLAYERS_PER_DAY,
        dailyOnboardingRate: PlayerManager.DAILY_ONBOARDING_RATE,
        dauTargets: PlayerManager.DAU_TARGETS,
        allowancePerDay: PlayerManager.ALLOWANCE_PER_DAY,
        newPlayerStartingDollars: PlayerManager.NEW_PLAYER_STARTING_DOLLARS,
      },
      this.dormantStore,
      this.poolSnapshotProvider
    );
    this.playerCreationManager.init();
  }

  private playerCreationManager: PlayerCreationManager;

  private dayStartedSubscription: EventSubscription | null = null;
  private simulationStartedSubscription: EventSubscription | null = null;
  private dayFrameCompletedSubscription: EventSubscription | null = null;
  private runCompletedSubscription: EventSubscription | null = null;
  private playerCreatedSubscription: EventSubscription | null = null;
  private cashOutCompletedSubscription: EventSubscription | null = null;
  // No end-of-day clearing subscription; we clear at next DAY_STARTED to avoid race with late events
  private pendingInitialPlayers: number = 0;
  // Number of days to spread initial player seeding across (default: 14)
  private initialPlayerSpreadDays: number = 14;
  // Throttles to prevent runaway growth and memory pressure
  private static readonly MAX_NEW_PLAYERS_PER_DAY = 3000;
  private static readonly DAILY_ONBOARDING_RATE = 0.02; // 2% of remaining gap per day
  // DAU targets by cohort (Base scenario from research)
  private static readonly DAU_TARGETS: Record<CashOutStrategy, number> = {
    [CashOutStrategy.CONSERVATIVE]: 0.18, // Light: 18% DAU
    [CashOutStrategy.BALANCED]: 0.26, // Mid: 26% DAU
    [CashOutStrategy.AGGRESSIVE]: 0.45, // Whales: 45% DAU
  };
  private static readonly NEW_PLAYER_STARTING_DOLLARS = 5;
  // Weekly allowance ranges from research (Base scenario) - divided by 7 for daily
  private static readonly ALLOWANCE_PER_DAY: Record<CashOutStrategy, number> = {
    [CashOutStrategy.CONSERVATIVE]: 4, // Light: $8-16/week = ~$1.1-2.3/day
    [CashOutStrategy.BALANCED]: 7, // Mid: $35-70/week = ~$5-10/day
    [CashOutStrategy.AGGRESSIVE]: 31, // Whales: $160-320/week = ~$23-46/day
  };

  // Active-only model counters
  private totalPlayersCounter = 0;
  private completedRunsCounter = 0; // Track players who completed their runs
  private dailyNewPlayersCounter = 0; // Track new players added today
  private dailyInitialPlayersCount = 0;
  private dailyGrowthPlayersCount = 0;
  private dailyDauNewPlayersCount = 0;
  private dailyDauReactivatedPlayersCount = 0;
  private lastInitialSeededSnapshot = 0;

  /**
   * Setup event subscriptions for event-driven processing
   */
  private setupEventSubscriptions(): void {
    this.simulationStartedSubscription = this.eventBus.on(
      EVENT_TYPES.SIMULATION_STARTED,
      this.handleSimulationStarted.bind(this),
      10
    );

    this.eventBus.on(EVENT_TYPES.MATCHMAKING_TERMINATED, () => {
      this.playerCreationManager.terminate();
    });

    this.dayStartedSubscription = this.eventBus.on<DayStartedEvent>(
      EVENT_TYPES.DAY_STARTED,
      this.handleDayStarted.bind(this),
      10
    );

    this.playerCreatedSubscription = this.eventBus.on(
      EVENT_TYPES.PLAYER_CREATED,
      this.handlePlayerCreated.bind(this),
      5
    );

    // Mark runs inactive when they complete (elimination or jackpot)
    this.runCompletedSubscription = this.eventBus.on(
      EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED as any,
      async (evt: any) => {
        const playerId = evt?.playerId;
        const dollarId = evt?.virtualDollarId;
        if (playerId && dollarId) {
          this.removeActiveRun(playerId, dollarId);
          // Track completed runs
          this.completedRunsCounter++;
          // Release completed dollar to free memory
          this.virtualDollarFactory.releaseDollar(dollarId);
        }
      },
      5
    );

    // Note: CASH_OUT_COMPLETED events are handled by the same VIRTUAL_DOLLAR_RUN_COMPLETED handler
    // since cash-outs should also emit VIRTUAL_DOLLAR_RUN_COMPLETED events

    this.cashOutCompletedSubscription = this.eventBus.on(
      EVENT_TYPES.CASH_OUT_COMPLETED,
      this.handleCashOutCompleted.bind(this),
      5
    );

    this.dayFrameCompletedSubscription =
      this.eventBus.on<DayFrameCompletedEvent>(
        EVENT_TYPES.DAY_FRAME_COMPLETED,
        this.handleDayFrameCompleted.bind(this),
        -10
      );
  }

  /**
   * Handle day started event - delegate player creation to PlayerCreationManager
   */
  private async handleDayStarted(event: DayStartedEvent): Promise<void> {
    if (
      event.dayNumber > 1 &&
      this.pendingInitialPlayers > 0 &&
      this.lastInitialSeededSnapshot === 0
    ) {
      console.warn(
        `[PlayerManager] Pending initial cohort (${this.pendingInitialPlayers}) has not advanced by day ${event.dayNumber - 1} - verify seeding.`
      );
    }
    // Sync state with PlayerCreationManager
    this.playerCreationManager.setInitialPlayers(
      this.pendingInitialPlayers,
      this.initialPlayerSpreadDays
    );

    // Delegate all player creation logic
    await this.playerCreationManager.processDayStarted(
      event,
      this.playerRegistry.size,
      this.getActivePlayerCount()
    );

    // Sync counters back
    const stats = this.playerCreationManager.getStats();
    this.totalPlayersCounter = stats.totalPlayersCounter;
    this.dailyNewPlayersCounter = stats.dailyNewPlayersCounter;
    this.pendingInitialPlayers = stats.pendingInitialPlayers;
    this.lastInitialSeededSnapshot = stats.initialPlayersSeededSoFar;
    this.dailyInitialPlayersCount = stats.dailyInitialPlayersCounter ?? 0;
    this.dailyGrowthPlayersCount = stats.dailyGrowthPlayersCounter ?? 0;
    this.dailyDauNewPlayersCount = stats.dailyDauNewPlayersCounter ?? 0;
    this.dailyDauReactivatedPlayersCount =
      stats.dailyDauReactivationsCounter ?? 0;
  }

  private handleDayFrameCompleted(_event: DayFrameCompletedEvent): void {
    this.dailyNewPlayersCounter = 0;
    this.playerCreationManager.resetDailyCounters();
  }

  private async handleSimulationStarted(event: any): Promise<void> {
    console.log(`[PlayerManager] handleSimulationStarted: event.config=`, event.config);
    // Store initial player count for seeding when strategies are available on DAY_STARTED
    const initial =
      event?.initialPlayerCount || event?.config?.initialPlayerCount || 0;
    const spread =
      typeof event?.config?.initialPlayerSpreadDays === "number"
        ? event.config.initialPlayerSpreadDays
        : typeof event?.initialPlayerSpreadDays === "number"
        ? event.initialPlayerSpreadDays
        : undefined;

    console.log(`[PlayerManager] initial=${initial}, spread=${spread}`);
    if (typeof spread === "number" && spread > 0) {
      this.initialPlayerSpreadDays = spread;
    }

    if (typeof initial === "number" && initial > 0) {
      this.pendingInitialPlayers = initial;
    }

    console.log(`[PlayerManager] After setting: pendingInitialPlayers=${this.pendingInitialPlayers}, initialPlayerSpreadDays=${this.initialPlayerSpreadDays}`);

    // Sync with PlayerCreationManager
    this.playerCreationManager.setInitialPlayers(
      this.pendingInitialPlayers,
      this.initialPlayerSpreadDays,
      { resetSeedProgress: true }
    );
  }

  private handlePlayerCreated(event: PlayerCreatedEvent): void {
    const existing = this.playerRegistry.get(event.playerId);
    if (existing) {
      existing.strategy = event.cashOutStrategy;
      existing.initialDonation = event.initialDonationAmount;
      return;
    }

    this.playerRegistry.set(event.playerId, {
      id: event.playerId,
      strategy: event.cashOutStrategy,
      initialDonation: event.initialDonationAmount,
      createdAt: event.timestamp,
      activeRunIds: [],
      totalRunsCreated: 0,
    });
  }

  private handleCashOutCompleted(event: CashOutCompletedEvent): void {
    // Clean up active run and release dollar for cash-outs
    this.removeActiveRun(event.playerId, event.virtualDollarId);
    this.virtualDollarFactory.releaseDollar(event.virtualDollarId);
    // Player balance updates are handled by RevenueTrackingHandler
    // This handler ensures the event is processed for consistency
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

    // For backward compatibility, create initial players synchronously
    const count = config.initialPlayerCount || 0;

    for (let i = 0; i < count; i++) {
      // Create player ID
      const playerId = `player-${i}`;

      // Create virtual dollar directly
      this.virtualDollarFactory.create(playerId);

      // Track player
      this.totalPlayersCounter++;
      this.dailyNewPlayersCounter++;
    }

    return count;
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
    const totalPlayers = this.totalPlayersCounter;
    const activePlayers = this.calculateDAUTargetFromTotal(totalPlayers);
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
      completedRunsPlayers: this.completedRunsCounter,
      totalCharityContributions: 0, // Will be populated by GameEngineSimulator with revenue data
      totalPlayerPayouts: 0, // Will be populated by GameEngineSimulator with revenue data
      totalProgressionFunds: totalProgressionFunds,
      averageGamesPerPlayer: 0, // Will be calculated by caller with game data
      playerRetirementRate:
        totalPlayers > 0 ? retiredPlayers / totalPlayers : 0,
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
   * Calculate DAU target based on total players using average DAU rate
   */
  private calculateDAUTargetFromTotal(totalPlayers: number): number {
    // Use average DAU rate across all strategies
    const averageDAURate =
      Object.values(PlayerManager.DAU_TARGETS).reduce(
        (sum, rate) => sum + rate,
        0
      ) / Object.keys(PlayerManager.DAU_TARGETS).length;

    return Math.floor(totalPlayers * averageDAURate);
  }

  /**
   * Peek at today's new player count without resetting the counter.
   */
  peekDailyNewPlayersCount(): number {
    return this.dailyNewPlayersCounter;
  }

  consumeDailyPlayerCreationStats(): {
    totalNewPlayers: number;
    initialPlayers: number;
    growthPlayers: number;
    dauNewPlayers: number;
    reactivatedPlayers: number;
  } {
    const stats = {
      totalNewPlayers: this.dailyNewPlayersCounter,
      initialPlayers: this.dailyInitialPlayersCount,
      growthPlayers: this.dailyGrowthPlayersCount,
      dauNewPlayers: this.dailyDauNewPlayersCount,
      reactivatedPlayers: this.dailyDauReactivatedPlayersCount,
    };
    this.dailyNewPlayersCounter = 0;
    this.dailyInitialPlayersCount = 0;
    this.dailyGrowthPlayersCount = 0;
    this.dailyDauNewPlayersCount = 0;
    this.dailyDauReactivatedPlayersCount = 0;
    return stats;
  }

  /**
   * Get daily new players count and reset for next day
   */
  getDailyNewPlayersCount(): number {
    const { totalNewPlayers } = this.consumeDailyPlayerCreationStats();
    return totalNewPlayers;
  }

  /**
   * Get total number of registered players
   */
  getTotalPlayerCount(): number {
    return this.playerRegistry.size;
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
      console.error(
        `Failed to create new run for player ${request.playerId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Auto-create runs for eligible players (those with fewer than maxRunsPerPlayer)
   */
  async autoCreateRuns(maxRunsPerPlayer: number = 1): Promise<VirtualDollar[]> {
    const newRuns: VirtualDollar[] = [];
    const batchSize = 1000; // Process in batches to avoid memory pressure
    const maxConcurrentBatches = 5; // Limit concurrent batches
    let activeBatches = 0;

    const players = Array.from(this.playerRegistry.values());

    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);

      if (activeBatches >= maxConcurrentBatches) {
        await new Promise((resolve) => setImmediate(resolve)); // Yield control
      }

      activeBatches++;
      Promise.all(
        batch.flatMap((player) => {
          const runsNeeded = Math.max(
            0,
            maxRunsPerPlayer - player.activeRunIds.length
          );
          return Array.from({ length: runsNeeded }, () =>
            this.createNewRun({
              playerId: player.id,
              cashOutStrategy: player.strategy,
              fundingSource: "DONATION",
            })
          ).filter(Boolean) as VirtualDollar[];
        })
      ).then((batchRuns) => {
        newRuns.push(...batchRuns.flat());
        activeBatches--;
      });
    }

    // Wait for all batches to complete
    while (activeBatches > 0) {
      await new Promise((resolve) => setImmediate(resolve));
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

  /**
   * Get the current winnings for a virtual dollar (used by cash-out decision logic)
   */
  getVirtualDollarCurrentWinnings(virtualDollarId: string): number {
    const virtualDollar = this.virtualDollarFactory.getDollar(virtualDollarId);
    return virtualDollar?.currentRunWinnings || 0;
  }

  /**
   * Terminate the simulation
   */
  terminate(): void {
    this.playerCreationManager.terminate();
  }

  dispose(): void {
    this.dayStartedSubscription?.unsubscribe();
    this.simulationStartedSubscription?.unsubscribe();
    this.runCompletedSubscription?.unsubscribe();
    this.playerCreatedSubscription?.unsubscribe();
    this.cashOutCompletedSubscription?.unsubscribe();
    this.dayFrameCompletedSubscription?.unsubscribe();
    this.dayStartedSubscription = null;
    this.simulationStartedSubscription = null;
    this.runCompletedSubscription = null;
    this.playerCreatedSubscription = null;
    this.cashOutCompletedSubscription = null;
    this.dayFrameCompletedSubscription = null;
    this.playerRegistry.clear();
  }
}
