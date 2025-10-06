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

  constructor(
    private eventBus: EventBus,
    private virtualDollarFactory: VirtualDollarFactory,
    private config: PlayerCreationConfig
  ) {}

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
  async processDayStarted(event: DayStartedEvent, currentPlayerCount: number = 0): Promise<void> {
    const { dayNumber, growthModel, playerStrategies } = event;

    if (this.simulationTerminated) {
      return;
    }

    // Source 1: Initial players spread
    await this.createInitialPlayers(dayNumber, playerStrategies, currentPlayerCount);

    // Source 2: New players from S-curve growth
    await this.createGrowthPlayers(dayNumber, growthModel, playerStrategies);

    // Source 3: DAU maintenance via reactivation and new players
    await this.maintainDAU(playerStrategies);
  }

  /**
   * Source 1: Spread initial players across configured days
   */
  private async createInitialPlayers(
    dayNumber: number,
    playerStrategies: Partial<Record<CashOutStrategy, number>>,
    currentPlayerCount: number
  ): Promise<void> {
    if (this.pendingInitialPlayers <= 0 || currentPlayerCount > 0) {
      return;
    }

    const remaining = this.pendingInitialPlayers - this.initialPlayersSeededSoFar;
    if (remaining <= 0) {
      return;
    }

    const dayIndex = Math.max(1, dayNumber);
    if (dayIndex > this.initialPlayerSpreadDays) {
      // Spread window passed; create remaining now
      const createNow = remaining;
      this.initialPlayersSeededSoFar += createNow;
      this.pendingInitialPlayers = 0;
      this.totalPlayersCounter += createNow;
      await this.createActives(createNow, playerStrategies, true);
      return;
    }

    const basePerDay = Math.floor(this.pendingInitialPlayers / this.initialPlayerSpreadDays);
    const remainder = this.pendingInitialPlayers % this.initialPlayerSpreadDays;
    const toCreate = dayIndex < this.initialPlayerSpreadDays
      ? basePerDay
      : basePerDay + remainder;

    const createNow = Math.min(Math.max(1, toCreate), remaining);
    this.initialPlayersSeededSoFar += createNow;
    this.totalPlayersCounter += createNow;

    if (this.initialPlayersSeededSoFar >= this.pendingInitialPlayers) {
      this.pendingInitialPlayers = 0;
    }

    await this.createActives(createNow, playerStrategies, true);
  }

  /**
   * Source 2: Create new players based on S-curve growth model
   */
  private async createGrowthPlayers(
    dayNumber: number,
    growthModel: any,
    playerStrategies: Partial<Record<CashOutStrategy, number>>
  ): Promise<void> {
    // Use S-curve growth model
    const x = (dayNumber - growthModel.midpointDay) / growthModel.steepnessFactor;
    const adoptionProgress = 1 / (1 + Math.exp(-x));
    const targetPlayers = Math.floor(
      growthModel.baseMarket * growthModel.adoptionRate * adoptionProgress
    );

    const currentPlayerCount = this.totalPlayersCounter;
    const playersToAdd = Math.max(0, targetPlayers - currentPlayerCount);

    if (playersToAdd === 0) {
      // Equilibrium reached - no new growth needed
      this.dailyNewPlayersCounter = 0;
      return;
    }

    // Throttle growth to prevent runaway
    const throttledFromRate = Math.max(
      1,
      Math.ceil(playersToAdd * this.config.dailyOnboardingRate)
    );
    const dailyNewPlayers = Math.min(
      playersToAdd,
      throttledFromRate,
      this.config.maxNewPlayersPerDay
    );

    if (dailyNewPlayers > 0) {
      this.totalPlayersCounter += dailyNewPlayers;
      this.dailyNewPlayersCounter += dailyNewPlayers;
      await this.createActives(dailyNewPlayers, playerStrategies, true);
    }
  }

  /**
   * Source 3: Maintain DAU through reactivation and new player creation
   */
  private async maintainDAU(
    playerStrategies: Partial<Record<CashOutStrategy, number>>
  ): Promise<void> {
    // Calculate cohort-based DAU targets
    const cohortTargets = this.calculateCohortDAUTargets();
    const totalTargetActives = Object.values(cohortTargets).reduce(
      (sum, count) => sum + count,
      0
    );

    if (totalTargetActives <= 0) {
      return;
    }

    // Get current active count (would need to be passed in or accessed)
    // For now, assume we need to calculate deficit
    // This would need integration with player registry to get active count
    const currentActive = 0; // Placeholder - need to integrate
    const deficit = Math.max(0, totalTargetActives - currentActive);

    if (deficit <= 0) {
      return;
    }

    // Prefer reactivation from inactive pool
    const inactiveStock = Math.max(0, this.totalPlayersCounter - currentActive);
    const reactivations = Math.min(deficit, inactiveStock);

    if (reactivations > 0) {
      await this.createActives(reactivations, playerStrategies, false);
    }

    const remaining = deficit - reactivations;
    if (remaining > 0) {
      this.totalPlayersCounter += remaining;
      this.dailyNewPlayersCounter += remaining;
      await this.createActives(remaining, playerStrategies, true);
    }
  }

  /**
   * Calculate DAU targets by cohort
   */
  private calculateCohortDAUTargets(): Record<CashOutStrategy, number> {
    const targets: Record<CashOutStrategy, number> = {
      [CashOutStrategy.CONSERVATIVE]: 0,
      [CashOutStrategy.BALANCED]: 0,
      [CashOutStrategy.AGGRESSIVE]: 0,
    };

    // Calculate based on total players and DAU rates
    // This would need current player distribution by cohort
    // For now, return placeholder
    return targets;
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
      const playerId = `${baseIdPrefix}-${this.totalPlayersCounter - count + i + 1}`;

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
        void this.eventBus.emit(EVENT_TYPES.PLAYER_CREATED, playerCreatedEvent).catch((error) =>
          console.error("[PlayerCreationManager] Failed to emit PLAYER_CREATED:", error)
        );
      } catch (error) {
        console.error("[PlayerCreationManager] Failed to emit PLAYER_CREATED:", error);
      }

      // Create virtual dollar runs based on daily allowance
      const allowance = this.config.allowancePerDay[strategy] || 1;
      const runsToCreate = Math.max(1, Math.floor(allowance / this.config.newPlayerStartingDollars));

      for (let run = 0; run < runsToCreate; run++) {
        try {
          const virtualDollar = await this.virtualDollarFactory.create(playerId);

          const newRunEvent: NewRunCreatedEvent = {
            type: EVENT_TYPES.NEW_RUN_CREATED,
            timestamp: seededAt,
            playerId,
            virtualDollarId: virtualDollar.id,
            fundingSource: "DONATION",
            cashOutStrategy: strategy,
            runCount: 1, // Would need to track per player
          };

          void this.eventBus.emit(EVENT_TYPES.NEW_RUN_CREATED, newRunEvent).catch((error) =>
            console.error(`[PlayerCreationManager] Failed to emit NEW_RUN_CREATED:`, error)
          );
        } catch (error) {
          console.error(`[PlayerCreationManager] Failed to create run for ${playerId}:`, error);
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