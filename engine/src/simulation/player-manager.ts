import { CashOutStrategy, VirtualDollar } from "../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { EventBus, type EventSubscription } from "../events/event-bus";
import {
  EVENT_TYPES,
  DayStartedEvent,
  DayFrameCompletedEvent,
  PlayerCreatedEvent,
  NewRunCreatedEvent,
  CashOutCompletedEvent,
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
    private virtualDollarFactory: VirtualDollarFactory
  ) {
    this.setupEventSubscriptions();
  }

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
  // Track how many initial players have been seeded so far
  private initialPlayersSeededSoFar: number = 0;
  private simulationTerminated = false;
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
      this.simulationTerminated = true;
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
   * Handle day started event - create new players and runs based on growth model
   */
  private async handleDayStarted(event: DayStartedEvent): Promise<void> {
    const { dayNumber, growthModel, playerStrategies } = event;

    // Note: do not clear here; we clear at DAY_COMPLETED to avoid racing in-flight events

    // Spread initial players across the configured initialPlayerSpreadDays window
    if (this.pendingInitialPlayers > 0 && this.playerRegistry.size === 0) {
      const remaining =
        this.pendingInitialPlayers - this.initialPlayersSeededSoFar;
      if (remaining > 0) {
        const dayIndex = Math.max(1, dayNumber);
        if (dayIndex <= this.initialPlayerSpreadDays) {
          const basePerDay = Math.floor(
            this.pendingInitialPlayers / this.initialPlayerSpreadDays
          );
          const remainder =
            this.pendingInitialPlayers % this.initialPlayerSpreadDays;
          const toCreate =
            dayIndex < this.initialPlayerSpreadDays
              ? basePerDay
              : basePerDay + remainder;
          // Ensure we create at least 1 on early days if basePerDay is 0
          const createNow = Math.min(Math.max(1, toCreate), remaining);
          this.initialPlayersSeededSoFar += createNow;
          this.totalPlayersCounter += createNow;
          if (!this.simulationTerminated) {
            void this.createActives(createNow, playerStrategies, true).catch(
              (error) =>
                console.error(
                  "[PlayerManager] Failed to create initial actives:",
                  error
                )
            );
          }
        } else {
          // Spread window passed; create remaining now
          const createNow = remaining;
          this.initialPlayersSeededSoFar += createNow;
          this.pendingInitialPlayers = 0;
          this.totalPlayersCounter += createNow;
          if (!this.simulationTerminated) {
            void this.createActives(createNow, playerStrategies, true).catch(
              (error) =>
                console.error(
                  "[PlayerManager] Failed to create leftover initial actives:",
                  error
                )
            );
          }
        }
      }
      if (this.initialPlayersSeededSoFar >= this.pendingInitialPlayers) {
        this.pendingInitialPlayers = 0;
      }
    }

    if (this.simulationTerminated) {
      return;
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

    // Add new players if we're below S-curve target (throttled)
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

    // Create new players to reach S-curve target
    if (dailyNewPlayers > 0 && !this.simulationTerminated) {
      this.totalPlayersCounter += dailyNewPlayers;
      this.dailyNewPlayersCounter += dailyNewPlayers;
      void this.createActives(dailyNewPlayers, playerStrategies, true).catch(
        (error) =>
          console.error(
            "[PlayerManager] Failed to create daily new actives:",
            error
          )
      );
    } else if (dailyNewPlayers === 0 && playersToAdd === 0) {
      // TEMPORARY: Equilibrium state reached - S-curve target met
      // TODO: Implement proper equilibrium handling for event-driven architecture
      // The system currently breaks when player growth stops due to event sequencing issues
      this.dailyNewPlayersCounter = 0;
      // Note: Equilibrium reached - no new player growth needed
    }

    // Note: we do not create passive players here; we only count them. Actives are created below to match DAU.

    // Create today's DAU actives: prefer reactivation, then mint new
    // Calculate cohort-based targets from research
    const cohortTargets = this.calculateCohortDAUTargets();
    const totalTargetActives = Object.values(cohortTargets).reduce(
      (sum, count) => sum + count,
      0
    );
    const currentActive = this.getActivePlayerCount();
    const deficit = Math.max(0, totalTargetActives - currentActive);

    if (this.simulationTerminated || totalTargetActives <= 0) {
      return;
    }

    if (deficit > 0) {
      const inactiveStock = Math.max(
        0,
        this.totalPlayersCounter - currentActive
      );
      const reactivations = Math.min(deficit, inactiveStock);
      if (reactivations > 0) {
        void this.createActives(reactivations, playerStrategies, false).catch(
          (error) =>
            console.error(
              "[PlayerManager] Failed to reactivate players:",
              error
            )
        );
      }

      const remaining = deficit - reactivations;
      if (remaining > 0 && !this.simulationTerminated) {
        this.totalPlayersCounter += remaining;
        this.dailyNewPlayersCounter += remaining;
        void this.createActives(remaining, playerStrategies, true).catch(
          (error) =>
            console.error(
              "[PlayerManager] Failed to create remaining daily actives:",
              error
            )
        );
      }
    }
  }

  private handleDayFrameCompleted(_event: DayFrameCompletedEvent): void {
    this.dailyNewPlayersCounter = 0;
  }

  private async handleSimulationStarted(event: any): Promise<void> {
    // Store initial player count for seeding when strategies are available on DAY_STARTED
    const initial =
      event?.initialPlayerCount || event?.config?.initialPlayerCount || 0;
    const spread =
      typeof event?.config?.initialPlayerSpreadDays === "number"
        ? event.config.initialPlayerSpreadDays
        : typeof event?.initialPlayerSpreadDays === "number"
        ? event.initialPlayerSpreadDays
        : undefined;

    if (typeof spread === "number" && spread > 0) {
      this.initialPlayerSpreadDays = Math.max(1, Math.floor(spread));
    }

    if (typeof initial === "number" && initial > 0) {
      this.pendingInitialPlayers = initial;
      this.initialPlayersSeededSoFar = 0;
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
    if (this.simulationTerminated || count <= 0) {
      return;
    }

    const strategies = Object.keys(playerStrategies) as CashOutStrategy[];
    const weights = Object.values(playerStrategies);

    const seededAt = new Date();
    const baseIdPrefix = isNew ? "player-new" : "player-reactivated";

    for (let i = 0; i < count; i++) {
      if (this.simulationTerminated) {
        break;
      }
      const playerId = `${baseIdPrefix}-${seededAt.getTime()}-${Math.random()
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

      if (this.simulationTerminated) {
        this.playerRegistry.delete(playerId);
        return;
      }

      void this.eventBus
        .emit(EVENT_TYPES.PLAYER_CREATED, {
          type: EVENT_TYPES.PLAYER_CREATED,
          timestamp: new Date(),
          playerId,
          initialDonationAmount: 100,
          cashOutStrategy: strategy,
          isNewPlayer: isNew,
        } as PlayerCreatedEvent)
        .catch((error) =>
          console.error("[PlayerManager] Failed to emit PLAYER_CREATED:", error)
        );

      const runsToCreate = isNew
        ? PlayerManager.NEW_PLAYER_STARTING_DOLLARS
        : PlayerManager.ALLOWANCE_PER_DAY[strategy] ?? 3;

      // Shuffle the order of dollar creation to interleave emissions and reduce same-owner clustering
      const indices = Array.from({ length: runsToCreate }, (_, i) => i).sort(
        () => Math.random() - 0.5
      );

      for (let i = 0; i < indices.length; i++) {
        setTimeout(() => {
          if (this.simulationTerminated) {
            return;
          }
          const newRun = this.createNewRun({
            playerId,
            cashOutStrategy: strategy,
            fundingSource: "DONATION",
          });
          if (newRun) {
            void this.eventBus
              .emit(EVENT_TYPES.NEW_RUN_CREATED, {
                type: EVENT_TYPES.NEW_RUN_CREATED,
                timestamp: new Date(),
                playerId,
                virtualDollarId: newRun.id,
                fundingSource: "DONATION",
                cashOutStrategy: strategy,
                runCount:
                  this.playerRegistry.get(playerId)?.totalRunsCreated ?? 1,
              } as NewRunCreatedEvent)
              .catch((error) =>
                console.error(
                  "[PlayerManager] Failed to emit NEW_RUN_CREATED:",
                  error
                )
              );
          } else {
            console.warn(
              `[PlayerManager] Failed to create run ${
                indices[i] + 1
              }/${runsToCreate} for ${playerId}`
            );
          }
        }, i * 50 + Math.random() * 20); // 50ms base delay per dollar with 0-20ms jitter for better interleaving
      }
    }
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

  private handleCashOutCompleted(_event: CashOutCompletedEvent): void {
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
   * Get daily new players count and reset for next day
   */
  getDailyNewPlayersCount(): number {
    const count = this.dailyNewPlayersCounter;
    this.dailyNewPlayersCounter = 0; // Reset for next day
    return count;
  }

  /**
   * Calculate DAU targets by cohort based on research data
   */
  private calculateCohortDAUTargets(): Record<CashOutStrategy, number> {
    const targets: Record<CashOutStrategy, number> = {
      [CashOutStrategy.CONSERVATIVE]: 0,
      [CashOutStrategy.BALANCED]: 0,
      [CashOutStrategy.AGGRESSIVE]: 0,
    };

    // Count players by strategy from active registry
    const strategyCounts: Record<CashOutStrategy, number> = {
      [CashOutStrategy.CONSERVATIVE]: 0,
      [CashOutStrategy.BALANCED]: 0,
      [CashOutStrategy.AGGRESSIVE]: 0,
    };

    for (const player of this.playerRegistry.values()) {
      strategyCounts[player.strategy]++;
    }

    // Calculate targets based on research DAU rates
    // Note: This calculates DAU target for currently active players only
    // The actual DAU target should be based on total players, but we only have active players in registry
    for (const strategy of Object.keys(CashOutStrategy) as CashOutStrategy[]) {
      const playerCount = strategyCounts[strategy];
      const dauRate = PlayerManager.DAU_TARGETS[strategy];
      targets[strategy] = Math.floor(playerCount * dauRate);
    }

    return targets;
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
