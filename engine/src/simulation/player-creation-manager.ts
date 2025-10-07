import { CashOutStrategy } from "../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../types/factory-interfaces";
import { EventBus } from "../events/event-bus";
import {
  EVENT_TYPES,
  DayStartedEvent,
  PlayerCreatedEvent,
  NewRunCreatedEvent,
} from "../events/event-types";

/**
 * Configuration for player creation
 */
export interface PlayerCreationConfig {
  initialPlayerSpreadDays: number;
  maxNewPlayersPerDay: number;
  dailyOnboardingRate: number;
  dauTargets: Record<CashOutStrategy, number>;
  allowancePerDay: Record<CashOutStrategy, number>;
  newPlayerStartingDollars: number;
}

/**
 * Manages all player creation sources to ensure coordinated and equilibrium-safe additions
 */
export class PlayerCreationManager {
  private pendingInitialPlayers: number = 0;
  private initialPlayerSpreadDays: number = 14;
  private initialPlayersSeededSoFar: number = 0;
  private totalPlayersCounter = 0;
  private dailyNewPlayersCounter = 0;
  private simulationTerminated = false;
  private recentPoolSnapshot: {
    totalDollarsInPool: number;
    availableForMatching: number;
    dollarsInGame: number;
  } | null = null;
  private static readonly BACKLOG_HARD_CAP = 2000;
  private static readonly BACKLOG_SOFT_CAP = 750;

  constructor(
    private eventBus: EventBus,
    private virtualDollarFactory: VirtualDollarFactory,
    private config: PlayerCreationConfig
  ) {}

  init(): void {
    this.eventBus.on(EVENT_TYPES.POOL_UPDATED, (evt: any) => {
      this.recentPoolSnapshot = {
        totalDollarsInPool: evt.totalDollarsInPool ?? 0,
        availableForMatching: evt.availableForMatching ?? 0,
        dollarsInGame: evt.dollarsInPlay ?? 0,
      };
    });
  }

  /**
   * Set initial player count for spreading
   */
  setInitialPlayers(count: number, spreadDays?: number): void {
    this.pendingInitialPlayers = count;
    this.initialPlayersSeededSoFar = 0;
    if (spreadDays) {
      this.initialPlayerSpreadDays = Math.max(1, Math.floor(spreadDays));
    }
  }

  /**
   * Terminate simulation - stop creating players
   */
  terminate(): void {
    this.simulationTerminated = true;
  }

  /**
   * Get current player creation statistics
   */
  getStats() {
    return {
      totalPlayersCounter: this.totalPlayersCounter,
      dailyNewPlayersCounter: this.dailyNewPlayersCounter,
      pendingInitialPlayers: this.pendingInitialPlayers,
      initialPlayersSeededSoFar: this.initialPlayersSeededSoFar,
    };
  }

  /**
   * Reset daily counters
   */
  resetDailyCounters(): void {
    this.dailyNewPlayersCounter = 0;
  }

  /**
   * Process player creation for a day - coordinates all three sources
   */
  async processDayStarted(
    event: DayStartedEvent,
    currentPlayerCount: number = 0,
    currentActiveCount: number = 0
  ): Promise<void> {
    const { dayNumber, growthModel, playerStrategies } = event;

    if (this.simulationTerminated) {
      return;
    }

    // Calculate all player additions upfront to avoid conflicts
    const additions = await this.calculateAllAdditions(
      dayNumber,
      growthModel,
      currentPlayerCount,
      currentActiveCount
    );

    // Apply all additions in a single batch
    await this.applyAdditions(additions, playerStrategies);
  }

  /**
   * Calculate all player additions for the day without applying them
   */
  private async calculateAllAdditions(
    dayNumber: number,
    growthModel: any,
    currentPlayerCount: number,
    currentActiveCount: number
  ): Promise<{
    initialPlayers: number;
    growthPlayers: number;
    dauReactivations: number;
    dauNewPlayers: number;
  }> {
    let initialPlayers = 0;
    let growthPlayers = 0;
    let dauReactivations = 0;
    let dauNewPlayers = 0;

    /**
     * Source 1: Spread initial players across configured days
     */
    if (this.pendingInitialPlayers > 0 && currentPlayerCount === 0) {
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
          initialPlayers = Math.min(Math.max(1, toCreate), remaining);
        } else {
          // Spread window passed; create remaining now
          initialPlayers = remaining;
        }
      }
    }

    // Calculate projected totals after initial players
    const projectedTotalAfterInitial = currentPlayerCount + initialPlayers;
    const projectedActiveAfterInitial = currentActiveCount + initialPlayers; // Assume initial are active

    /**
     * Source 2: Create new players based on S-curve growth model
     */
    const x =
      (dayNumber - growthModel.midpointDay) / growthModel.steepnessFactor;
    const adoptionProgress = 1 / (1 + Math.exp(-x));
    const targetPlayers = Math.floor(
      growthModel.baseMarket * growthModel.adoptionRate * adoptionProgress
    );

    const playersToAdd = Math.max(
      0,
      targetPlayers - projectedTotalAfterInitial
    );
    if (playersToAdd > 0) {
      // Throttle growth to prevent runaway
      const throttledFromRate = Math.max(
        1,
        Math.ceil(playersToAdd * this.config.dailyOnboardingRate)
      );
      growthPlayers = Math.min(
        playersToAdd,
        throttledFromRate,
        this.config.maxNewPlayersPerDay
      );
    }

    // Calculate projected totals after growth
    const projectedTotalAfterGrowth =
      projectedTotalAfterInitial + growthPlayers;
    const projectedActiveAfterGrowth =
      projectedActiveAfterInitial + growthPlayers;

    /**
     * Source 3: DAU maintenance (based on projected active count)
     * For simplicity, use a total DAU target based on projected total players
     * In a full implementation, this would use cohort-based targets
     */
    const estimatedTotalPlayers = projectedTotalAfterGrowth;
    const totalTargetActives = Math.floor(estimatedTotalPlayers * 0.25); // Simplified DAU rate

    const deficit = Math.max(
      0,
      totalTargetActives - projectedActiveAfterGrowth
    );
    if (deficit > 0) {
      const inactiveStock = Math.max(
        0,
        projectedTotalAfterGrowth - projectedActiveAfterGrowth
      );
      dauReactivations = Math.min(deficit, inactiveStock);
      dauNewPlayers = deficit - dauReactivations;
    }

    return {
      initialPlayers,
      growthPlayers,
      dauReactivations,
      dauNewPlayers,
    };
  }

  /**
   * Apply all calculated additions in a single batch
   */
  private async applyAdditions(
    additions: {
      initialPlayers: number;
      growthPlayers: number;
      dauReactivations: number;
      dauNewPlayers: number;
    },
    playerStrategies: Partial<Record<CashOutStrategy, number>>
  ): Promise<void> {
    const snapshot = this.recentPoolSnapshot;
    let { initialPlayers, growthPlayers, dauReactivations, dauNewPlayers } =
      additions;

    if (snapshot) {
      const backlog =
        snapshot.totalDollarsInPool - snapshot.availableForMatching;
      if (backlog > PlayerCreationManager.BACKLOG_HARD_CAP) {
        growthPlayers = 0;
        dauNewPlayers = 0;
      } else if (backlog > PlayerCreationManager.BACKLOG_SOFT_CAP) {
        const scale = 1 - backlog / PlayerCreationManager.BACKLOG_HARD_CAP;
        growthPlayers = Math.floor(growthPlayers * Math.max(scale, 0.1));
        dauNewPlayers = Math.floor(dauNewPlayers * Math.max(scale, 0));
      }
    }

    const { initialPlayers: finalInitial, growthPlayers: finalGrowth, dauReactivations: finalReactivations, dauNewPlayers: finalNew } = {
      initialPlayers,
      growthPlayers,
      dauReactivations,
      dauNewPlayers
    };

    // Apply initial players
    if (finalInitial > 0) {
      this.initialPlayersSeededSoFar += finalInitial;
      this.totalPlayersCounter += finalInitial;
      this.dailyNewPlayersCounter += finalInitial;
      if (this.initialPlayersSeededSoFar >= this.pendingInitialPlayers) {
        this.pendingInitialPlayers = 0;
      }
      await this.createActives(finalInitial, playerStrategies, true);
    }

    // Apply growth players
    if (finalGrowth > 0) {
      this.totalPlayersCounter += finalGrowth;
      this.dailyNewPlayersCounter += finalGrowth;
      await this.createActives(finalGrowth, playerStrategies, true);
    }

    // Apply DAU reactivations
    if (finalReactivations > 0) {
      await this.createActives(finalReactivations, playerStrategies, false);
    }

    // Apply DAU new players
    if (finalNew > 0) {
      this.totalPlayersCounter += finalNew;
      this.dailyNewPlayersCounter += finalNew;
      await this.createActives(finalNew, playerStrategies, true);
    }
  }

  /**
   * Create active players and allocate runs
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

    for (let i = 0; i < count; i++) {
      // Select strategy based on weights
      const strategy = this.selectWeightedStrategy(strategies, weights);

      // Create player ID
      const baseIdPrefix = isNew ? "player-new" : "player-reactivated";
      const playerId = `${baseIdPrefix}-${
        this.totalPlayersCounter - count + i + 1
      }`;

      // Emit player created event
      const playerCreatedEvent: PlayerCreatedEvent = {
        type: EVENT_TYPES.PLAYER_CREATED,
        timestamp: seededAt,
        playerId,
        initialDonationAmount: 0, // Would need to be configured
        cashOutStrategy: strategy,
        isNewPlayer: isNew,
      };

      try {
        void this.eventBus
          .emit(EVENT_TYPES.PLAYER_CREATED, playerCreatedEvent)
          .catch((error) =>
            console.error(
              "[PlayerCreationManager] Failed to emit PLAYER_CREATED:",
              error
            )
          );
      } catch (error) {
        console.error(
          "[PlayerCreationManager] Failed to emit PLAYER_CREATED:",
          error
        );
      }

      // Create virtual dollar runs based on daily allowance
      const allowance = this.config.allowancePerDay[strategy] || 1;
      const runsToCreate = Math.max(
        1,
        Math.floor(allowance / this.config.newPlayerStartingDollars)
      );

      for (let run = 0; run < runsToCreate; run++) {
        try {
          const virtualDollar = await this.virtualDollarFactory.create(
            playerId
          );

          const newRunEvent: NewRunCreatedEvent = {
            type: EVENT_TYPES.NEW_RUN_CREATED,
            timestamp: seededAt,
            playerId,
            virtualDollarId: virtualDollar.id,
            fundingSource: "DONATION",
            cashOutStrategy: strategy,
            runCount: 1, // Would need to track per player
          };

          void this.eventBus
            .emit(EVENT_TYPES.NEW_RUN_CREATED, newRunEvent)
            .catch((error) =>
              console.error(
                `[PlayerCreationManager] Failed to emit NEW_RUN_CREATED:`,
                error
              )
            );
        } catch (error) {
          console.error(
            `[PlayerCreationManager] Failed to create run for ${playerId}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Select strategy based on weighted distribution
   */
  private selectWeightedStrategy(
    strategies: CashOutStrategy[],
    weights: number[]
  ): CashOutStrategy {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < strategies.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return strategies[i];
      }
    }

    return strategies[strategies.length - 1];
  }
}
