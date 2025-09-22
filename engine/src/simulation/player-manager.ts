import { CashOutStrategy, VirtualDollar } from "../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { EventBus, type EventSubscription } from "../events/event-bus";
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

  private dayStartedSubscription: EventSubscription | null = null;
  private simulationStartedSubscription: EventSubscription | null = null;
  private runCompletedSubscription: EventSubscription | null = null;
  private cashOutCompletedSubscription: EventSubscription | null = null;
  // No end-of-day clearing subscription; we clear at next DAY_STARTED to avoid race with late events
  private pendingInitialPlayers: number = 0;
  // Throttles to prevent runaway growth and memory pressure
  private static readonly MAX_NEW_PLAYERS_PER_DAY = 2000;
  private static readonly DAILY_ONBOARDING_RATE = 0.02; // 2% of remaining gap per day
  private static readonly TARGET_DAU_RATIO = 0.05; // 5% of total players active per day
  private static readonly NEW_PLAYER_STARTING_DOLLARS = 5;
  private static readonly ALLOWANCE_PER_DAY: Record<CashOutStrategy, number> = {
    [CashOutStrategy.CONSERVATIVE]: 2,
    [CashOutStrategy.BALANCED]: 4,
    [CashOutStrategy.AGGRESSIVE]: 6,
  };

  // Active-only model counters
  private totalPlayersCounter = 0;

  /**
   * Setup event subscriptions for event-driven processing
   */
  private setupEventSubscriptions(): void {
    this.simulationStartedSubscription = this.eventBus.on(
      EVENT_TYPES.SIMULATION_STARTED,
      this.handleSimulationStarted.bind(this),
      10
    );
    this.dayStartedSubscription = this.eventBus.on<DayStartedEvent>(
      EVENT_TYPES.DAY_STARTED,
      this.handleDayStarted.bind(this),
      10 // High priority
    );

    // Mark runs inactive when they complete (elimination or jackpot)
    this.runCompletedSubscription = this.eventBus.on(
      EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED as any,
      async (evt: any) => {
        const playerId = evt?.playerId;
        const dollarId = evt?.virtualDollarId;
        if (playerId && dollarId) {
          this.removeActiveRun(playerId, dollarId);
          // Release completed dollar to free memory
          this.virtualDollarFactory.releaseDollar(dollarId);
        }
      },
      5
    );

    // Mark runs inactive on cash-out completion
    this.cashOutCompletedSubscription = this.eventBus.on(
      EVENT_TYPES.CASH_OUT_COMPLETED as any,
      async (evt: any) => {
        const playerId = evt?.playerId;
        const dollarId = evt?.virtualDollarId;
        if (playerId && dollarId) {
          this.removeActiveRun(playerId, dollarId);
          // Release cashed-out dollar to free memory
          this.virtualDollarFactory.releaseDollar(dollarId);
        }
      },
      5
    );

    // Clear previous day's actives at next DAY_STARTED (safe point)
  }

  /**
   * Handle day started event - create new players and runs based on growth model
   */
  private async handleDayStarted(event: DayStartedEvent): Promise<void> {
    const { dayNumber, growthModel, playerStrategies } = event;

    // Note: do not clear here; we clear at DAY_COMPLETED to avoid racing in-flight events

    // Seed initial players on first day as actives; count them globally, but only keep actives in memory
    if (this.pendingInitialPlayers > 0 && this.playerRegistry.size === 0) {
      const initialToCreate = this.pendingInitialPlayers;
      this.pendingInitialPlayers = 0;
      this.totalPlayersCounter += initialToCreate;
      await this.createActives(initialToCreate, playerStrategies, true);
    }

    // Use S-curve growth model from event
    const x =
      (dayNumber - growthModel.midpointDay) / growthModel.steepnessFactor;
    const adoptionProgress = 1 / (1 + Math.exp(-x));
    const targetPlayers = Math.floor(
      growthModel.baseMarket * growthModel.adoptionRate * adoptionProgress
    );

    // Calculate current total player count from counter (active-only model)
    const currentPlayerCount = this.totalPlayersCounter;

    // Add new players if we're below target (throttled)
    const playersToAdd = Math.max(0, targetPlayers - currentPlayerCount);
    const throttledFromRate = Math.max(
      1,
      Math.ceil(playersToAdd * PlayerManager.DAILY_ONBOARDING_RATE)
    );
    const dailyNewPlayers = Math.min(
      playersToAdd,
      throttledFromRate,
      PlayerManager.MAX_NEW_PLAYERS_PER_DAY
    );
    // We only count new players; actives are created below to match DAU
    void dailyNewPlayers;

    // Note: we do not create passive players here; we only count them. Actives are created below to match DAU.

    // Create today's DAU actives: prefer reactivation, then mint new
    const targetDailyActives = Math.floor(
      this.totalPlayersCounter * PlayerManager.TARGET_DAU_RATIO
    );
    const currentActive = this.getActivePlayerCount();
    const deficit = Math.max(0, targetDailyActives - currentActive);

    if (deficit > 0) {
      const inactiveStock = Math.max(
        0,
        this.totalPlayersCounter - currentActive
      );
      const reactivations = Math.min(deficit, inactiveStock);
      if (reactivations > 0) {
        await this.createActives(reactivations, playerStrategies, false);
      }

      const remaining = deficit - reactivations;
      if (remaining > 0) {
        this.totalPlayersCounter += remaining;
        await this.createActives(remaining, playerStrategies, true);
      }
    }
  }

  private async handleSimulationStarted(event: any): Promise<void> {
    // Store initial player count for seeding when strategies are available on DAY_STARTED
    const initial =
      event?.initialPlayerCount || event?.config?.initialPlayerCount || 0;
    if (typeof initial === "number" && initial > 0) {
      this.pendingInitialPlayers = initial;
    }
  }

  /**
   * Create active players (reactivated or new) and allocate runs per allowance
   */
  private async createActives(
    count: number,
    playerStrategies: Partial<Record<CashOutStrategy, number>>,
    isNew: boolean
  ): Promise<void> {
    const strategies = Object.keys(playerStrategies) as CashOutStrategy[];
    const weights = Object.values(playerStrategies);

    for (let i = 0; i < count; i++) {
      const idPrefix = isNew ? "player-new" : "player-reactivated";
      const playerId = `${idPrefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}-${i}`;

      // Weighted pick
      const r = Math.random();
      let cum = 0;
      let strategy: CashOutStrategy = CashOutStrategy.BALANCED;
      for (let j = 0; j < strategies.length; j++) {
        cum += weights[j] ?? 0;
        if (r <= cum) {
          strategy = strategies[j];
          break;
        }
      }

      this.playerRegistry.set(playerId, {
        id: playerId,
        strategy,
        initialDonation: 100,
        createdAt: new Date(),
        activeRunIds: [],
        totalRunsCreated: 0,
      });

      await this.eventBus.emit(EVENT_TYPES.PLAYER_CREATED, {
        type: EVENT_TYPES.PLAYER_CREATED,
        timestamp: new Date(),
        playerId,
        initialDonationAmount: 100,
        cashOutStrategy: strategy,
        isNewPlayer: isNew,
      } as PlayerCreatedEvent);

      const runsToCreate = isNew
        ? PlayerManager.NEW_PLAYER_STARTING_DOLLARS
        : PlayerManager.ALLOWANCE_PER_DAY[strategy] ?? 3;

      for (let k = 0; k < runsToCreate; k++) {
        const newRun = this.createNewRun({
          playerId,
          cashOutStrategy: strategy,
          fundingSource: "DONATION",
        });
        if (newRun) {
          await this.eventBus.emit(EVENT_TYPES.NEW_RUN_CREATED, {
            type: EVENT_TYPES.NEW_RUN_CREATED,
            timestamp: new Date(),
            playerId,
            virtualDollarId: newRun.id,
            fundingSource: "DONATION",
            cashOutStrategy: strategy,
            runCount: this.playerRegistry.get(playerId)?.totalRunsCreated ?? 1,
          } as NewRunCreatedEvent);
        }
      }
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
    const totalPlayers = this.totalPlayersCounter;
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
  autoCreateRuns(maxRunsPerPlayer: number = 1): VirtualDollar[] {
    const newRuns: VirtualDollar[] = [];

    for (const player of this.playerRegistry.values()) {
      // Create runs for players with fewer than max concurrent runs
      const runsNeeded = Math.max(
        0,
        maxRunsPerPlayer - player.activeRunIds.length
      );

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

  dispose(): void {
    this.dayStartedSubscription?.unsubscribe();
    this.simulationStartedSubscription?.unsubscribe();
    this.runCompletedSubscription?.unsubscribe();
    this.cashOutCompletedSubscription?.unsubscribe();
    // no day-completed subscription
    this.dayStartedSubscription = null;
    this.simulationStartedSubscription = null;
    this.runCompletedSubscription = null;
    this.cashOutCompletedSubscription = null;
    // no day-completed subscription
    this.playerRegistry.clear();
  }
}
