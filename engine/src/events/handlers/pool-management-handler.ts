/**
 * PoolManagementHandler - Event-driven pool state management
 * Handles virtual dollar re-pooling logic extracted from DayProcessor
 */

import { EventBus, EventSubscription } from "../event-bus";
import {
  ContinuePlayEvent,
  CashOutCompletedEvent,
  NewRunPooledEvent,
  PoolCapacityReachedEvent,
  PoolManagementErrorEvent,
  PoolStatsUpdatedEvent,
  EVENT_TYPES,
} from "../event-types";
import { DollarState } from "../../types/virtual-dollar-engine";
import { VirtualDollarManager } from "../../types/virtual-dollar-types";
import { GameMatchingEngine, PoolStatistics } from "../../types/game-matching-engine";


/**
 * Pool management handler that processes re-pooling events
 */
export class PoolManagementHandler {
  private continuePlaySubscription: EventSubscription | null = null;
  private cashOutCompletedSubscription: EventSubscription | null = null;

  constructor(
    private eventBus: EventBus,
    private gameMatchingEngine: GameMatchingEngine,
    private dollarManager: VirtualDollarManager
  ) {
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    // Subscribe to CONTINUE_PLAY events to re-pool winners
    this.continuePlaySubscription = this.eventBus.on<ContinuePlayEvent>(
      EVENT_TYPES.CONTINUE_PLAY,
      this.handleContinuePlay.bind(this),
      10 // High priority to ensure pool operations happen first
    );

    // Subscribe to CASH_OUT_COMPLETED events to handle new run creation
    this.cashOutCompletedSubscription = this.eventBus.on<CashOutCompletedEvent>(
      EVENT_TYPES.CASH_OUT_COMPLETED,
      this.handleCashOutCompleted.bind(this),
      5 // Medium priority after cash-out processing
    );
  }

  /**
   * Handle CONTINUE_PLAY event by re-pooling the winner's dollar
   */
  private async handleContinuePlay(event: ContinuePlayEvent): Promise<void> {
    try {
      await this.rePoolWinner(event);
    } catch (error) {
      console.error(
        `[PoolManagementHandler] Error re-pooling winner:`,
        error
      );

      await this.eventBus.emit(EVENT_TYPES.POOL_MANAGEMENT_ERROR, {
        type: EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        timestamp: new Date(),
        virtualDollarId: event.virtualDollarId,
        operation: "RE_POOL_WINNER",
        error: error instanceof Error ? error.message : String(error),
      } as PoolManagementErrorEvent);
    }
  }

  /**
   * Handle CASH_OUT_COMPLETED event by potentially creating new runs
   */
  private async handleCashOutCompleted(event: CashOutCompletedEvent): Promise<void> {
    try {
      // For completed runs, create a new run if the player wants to continue playing
      if (event.runCompleted && !event.wasJackpot) {
        await this.createNewRunFromCashOut(event);
      }
    } catch (error) {
      console.error(
        `[PoolManagementHandler] Error handling cash-out completion:`,
        error
      );

      await this.eventBus.emit(EVENT_TYPES.POOL_MANAGEMENT_ERROR, {
        type: EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        timestamp: new Date(),
        virtualDollarId: event.virtualDollarId,
        operation: "ADD_TO_POOL",
        error: error instanceof Error ? error.message : String(error),
      } as PoolManagementErrorEvent);
    }
  }

  /**
   * Re-pool a winner who chose to continue playing
   */
  private async rePoolWinner(event: ContinuePlayEvent): Promise<void> {
    // Get the virtual dollar from the manager
    const virtualDollar = this.dollarManager.getDollar(event.virtualDollarId);
    
    if (!virtualDollar) {
      throw new Error("Virtual dollar not found");
    }

    // Validate dollar state
    if (virtualDollar.state === DollarState.LOST) {
      await this.eventBus.emit(EVENT_TYPES.POOL_MANAGEMENT_ERROR, {
        type: EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        timestamp: new Date(),
        virtualDollarId: event.virtualDollarId,
        operation: "STATE_VALIDATION",
        error: `Invalid dollar state for pooling: ${virtualDollar.state}`,
      } as PoolManagementErrorEvent);
      return;
    }

    // Get current pool statistics
    const previousStats = this.gameMatchingEngine.getPoolStatistics();

    // Update dollar state to POOLED
    this.dollarManager.updateDollarState(event.virtualDollarId, DollarState.POOLED);

    // Add to pool through GameMatchingEngine
    const addResult = this.gameMatchingEngine.addToPool(virtualDollar);
    
    if (!addResult.success) {
      // Handle pool capacity or other constraints
      if (addResult.error?.includes("capacity")) {
        await this.eventBus.emit(EVENT_TYPES.POOL_CAPACITY_REACHED, {
          type: EVENT_TYPES.POOL_CAPACITY_REACHED,
          timestamp: new Date(),
          currentPoolSize: previousStats.totalDollarsInPool,
          maxCapacity: 1000, // Default capacity
          reason: addResult.error,
          rejectedDollarId: event.virtualDollarId,
        } as PoolCapacityReachedEvent);
      } else {
        await this.eventBus.emit(EVENT_TYPES.POOL_MANAGEMENT_ERROR, {
          type: EVENT_TYPES.POOL_MANAGEMENT_ERROR,
          timestamp: new Date(),
          virtualDollarId: event.virtualDollarId,
          operation: "ADD_TO_POOL",
          error: addResult.error || "Unknown pool operation error",
          integrationComponent: "GameMatchingEngine",
        } as PoolManagementErrorEvent);
      }
      return;
    }

    // Get updated pool statistics
    const currentStats = this.gameMatchingEngine.getPoolStatistics();

    // Emit pool stats update event
    await this.eventBus.emit(EVENT_TYPES.POOL_STATS_UPDATED, {
      type: EVENT_TYPES.POOL_STATS_UPDATED,
      timestamp: new Date(),
      previousStats: {
        totalDollarsInPool: previousStats.totalDollarsInPool,
        availableForMatching: previousStats.availableForMatching,
        dollarsInGame: previousStats.dollarsInGame,
      },
      currentStats: {
        totalDollarsInPool: currentStats.totalDollarsInPool,
        availableForMatching: currentStats.availableForMatching,
        dollarsInGame: currentStats.dollarsInGame,
      },
      operation: "ADD_TO_POOL",
    } as PoolStatsUpdatedEvent);

    console.log(
      `[PoolManagementHandler] Re-pooled winner ${event.playerId} (${event.virtualDollarId}) at level ${event.currentLevel}`
    );
  }

  /**
   * Create a new run for a player who just cashed out
   */
  private async createNewRunFromCashOut(event: CashOutCompletedEvent): Promise<void> {
    // Create new virtual dollar for the run (using only playerId as required by interface)
    const newRun = this.dollarManager.createVirtualDollar(event.playerId);

    if (!newRun) {
      throw new Error("Failed to create new run");
    }

    // Get current pool statistics before adding
    const previousStats = this.gameMatchingEngine.getPoolStatistics();

    // Update state to POOLED before adding to matching engine
    this.dollarManager.updateDollarState(newRun.id, DollarState.POOLED);

    // Add to pool
    const addResult = this.gameMatchingEngine.addToPool(newRun);
    
    if (!addResult.success) {
      await this.eventBus.emit(EVENT_TYPES.POOL_MANAGEMENT_ERROR, {
        type: EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        timestamp: new Date(),
        virtualDollarId: newRun.id,
        operation: "ADD_TO_POOL",
        error: addResult.error || "Failed to add new run to pool",
        integrationComponent: "GameMatchingEngine",
      } as PoolManagementErrorEvent);
      return;
    }

    // Get updated pool statistics
    const currentStats = this.gameMatchingEngine.getPoolStatistics();

    // Emit new run pooled event
    await this.eventBus.emit(EVENT_TYPES.NEW_RUN_POOLED, {
      type: EVENT_TYPES.NEW_RUN_POOLED,
      timestamp: new Date(),
      playerId: event.playerId,
      virtualDollarId: newRun.id,
      previousRunId: event.virtualDollarId,
      fundingSource: "CASH_OUT_REINVESTMENT",
      poolSize: currentStats.totalDollarsInPool,
    } as NewRunPooledEvent);

    // Emit pool stats update event
    await this.eventBus.emit(EVENT_TYPES.POOL_STATS_UPDATED, {
      type: EVENT_TYPES.POOL_STATS_UPDATED,
      timestamp: new Date(),
      previousStats: {
        totalDollarsInPool: previousStats.totalDollarsInPool,
        availableForMatching: previousStats.availableForMatching,
        dollarsInGame: previousStats.dollarsInGame,
      },
      currentStats: {
        totalDollarsInPool: currentStats.totalDollarsInPool,
        availableForMatching: currentStats.availableForMatching,
        dollarsInGame: currentStats.dollarsInGame,
      },
      operation: "ADD_TO_POOL",
    } as PoolStatsUpdatedEvent);

    console.log(
      `[PoolManagementHandler] Created and pooled new run ${newRun.id} for player ${event.playerId} after cash-out`
    );
  }

  /**
   * Get current pool statistics
   */
  getPoolStatistics(): PoolStatistics {
    return this.gameMatchingEngine.getPoolStatistics();
  }

  /**
   * Manual pool synchronization for error recovery
   */
  async synchronizePool(): Promise<void> {
    try {
      const stats = this.gameMatchingEngine.getPoolStatistics();
      
      await this.eventBus.emit(EVENT_TYPES.POOL_STATS_UPDATED, {
        type: EVENT_TYPES.POOL_STATS_UPDATED,
        timestamp: new Date(),
        previousStats: {
          totalDollarsInPool: stats.totalDollarsInPool,
          availableForMatching: stats.availableForMatching,
          dollarsInGame: stats.dollarsInGame,
        },
        currentStats: {
          totalDollarsInPool: stats.totalDollarsInPool,
          availableForMatching: stats.availableForMatching,
          dollarsInGame: stats.dollarsInGame,
        },
        operation: "ADD_TO_POOL", // Generic operation for sync
      } as PoolStatsUpdatedEvent);
    } catch (error) {
      await this.eventBus.emit(EVENT_TYPES.POOL_MANAGEMENT_ERROR, {
        type: EVENT_TYPES.POOL_MANAGEMENT_ERROR,
        timestamp: new Date(),
        virtualDollarId: "SYNC_OPERATION",
        operation: "POOL_SYNC",
        error: error instanceof Error ? error.message : String(error),
      } as PoolManagementErrorEvent);
    }
  }

  /**
   * Dispose of the handler and clean up subscriptions
   */
  dispose(): void {
    if (this.continuePlaySubscription) {
      this.continuePlaySubscription.unsubscribe();
      this.continuePlaySubscription = null;
    }

    if (this.cashOutCompletedSubscription) {
      this.cashOutCompletedSubscription.unsubscribe();
      this.cashOutCompletedSubscription = null;
    }
  }
}