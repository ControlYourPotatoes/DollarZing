/**
 * PlayerProgressionHandler - Event-driven player progression and level advancement
 * Handles player progression logic using real VirtualDollar objects from VirtualDollarManager
 */

import { EventBus, EventSubscription } from "../event-bus";
import {
  GameResolvedEvent,
  ContinuePlayEvent,
  VirtualDollarAdvancedEvent,
  VirtualDollarRunCompletedEvent,
  VirtualDollarProgressionFailedEvent,
  PlayerTotalWinningsUpdatedEvent,
  EVENT_TYPES,
} from "../event-types";
import { BettingLevel, DollarState } from "../../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../../types/factory-interfaces";
import { GameMatchingEngine } from "../../core/game-matching-engine";

export class PlayerProgressionHandler {
  private gameResolvedSubscription: EventSubscription | null = null;
  private continuePlaySubscription: EventSubscription | null = null;
  private loggingEnabled: boolean;

  constructor(
    private eventBus: EventBus,
    private virtualDollarFactory: VirtualDollarFactory,
    private gameMatchingEngine: GameMatchingEngine,
    options?: { loggingEnabled?: boolean }
  ) {
    this.loggingEnabled = options?.loggingEnabled ?? true;
    this.setupEventSubscriptions();
  }

  setLoggingEnabled(enabled: boolean): void {
    this.loggingEnabled = enabled;
  }

  private setupEventSubscriptions(): void {
    // Subscribe to GAME_RESOLVED events to handle loser elimination
    this.gameResolvedSubscription = this.eventBus.on<GameResolvedEvent>(
      EVENT_TYPES.GAME_RESOLVED,
      this.handleGameResolved.bind(this),
      12 // Higher priority to advance winner after cash-out decisions (12 < 15)
    );

    // Subscribe to CONTINUE_PLAY events to handle winner progression
    this.continuePlaySubscription = this.eventBus.on<ContinuePlayEvent>(
      EVENT_TYPES.CONTINUE_PLAY,
      this.handleContinuePlay.bind(this),
      12 // Higher priority to advance winner after cash-out decisions (12 < 15)
    );
  }

  private async handleGameResolved(event: GameResolvedEvent): Promise<void> {
    try {
      // Only process loser elimination - winners are processed after cash-out decision
      await this.processLoserElimination(event);
    } catch (error) {
      console.error(
        `[PlayerProgressionHandler] Error processing loser elimination:`,
        error
      );

      const progressionFailedEvent: VirtualDollarProgressionFailedEvent = {
        type: EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
        timestamp: new Date(),
        playerId: event.loserId,
        virtualDollarId: event.loserDollarId,
        currentLevel: event.loserLevel,
        reason: "Loser elimination failed",
        error: error instanceof Error ? error.message : String(error),
      };

      await this.eventBus.emit(
        EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
        progressionFailedEvent
      );
    }
  }

  private async handleContinuePlay(event: ContinuePlayEvent): Promise<void> {
    try {
      // Process winner progression only after they decided to continue
      await this.processWinnerProgression(event);
    } catch (error) {
      console.error(
        `[PlayerProgressionHandler] Error processing winner progression:`,
        error
      );

      const progressionFailedEvent: VirtualDollarProgressionFailedEvent = {
        type: EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
        timestamp: new Date(),
        playerId: event.playerId,
        virtualDollarId: event.virtualDollarId,
        currentLevel: event.currentLevel,
        reason: "Winner progression failed",
        error: error instanceof Error ? error.message : String(error),
      };

      await this.eventBus.emit(
        EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
        progressionFailedEvent
      );
    }
  }

  private async processWinnerProgression(
    event: ContinuePlayEvent
  ): Promise<void> {
    try {
      // Resolve a valid virtual dollar id (defensive in case event payload is missing it)
      let vdId = event.virtualDollarId;
      if (!vdId || typeof vdId !== "string" || vdId.length === 0) {
        const activeRuns = this.virtualDollarFactory.getActiveRunsByPlayer(
          event.playerId
        );
        vdId = activeRuns.length > 0 ? activeRuns[0].id : "";
      }

      if (!vdId) {
        throw new Error("Missing virtualDollarId for winner progression");
      }

      // Calculate progression using factory
      const newLevel = Math.min(10, event.nextLevel) as BettingLevel;
      const levelWinnings =
        this.virtualDollarFactory.calculateLevelWinnings(newLevel);

      // Use factory to advance player - handles all validation and state management
      const updatedDollar = this.virtualDollarFactory.advancePlayerLevel(
        vdId,
        newLevel,
        levelWinnings
      );

      if (this.loggingEnabled) {
        console.log(
          `[PlayerProgressionHandler] Winner ${event.playerId} advanced from Level ${event.currentLevel} to Level ${newLevel}, winnings: ${updatedDollar.currentRunWinnings}`
        );
      }

      // Check if run is complete (reached Level 10 = Jackpot)
      if (newLevel >= 10) {
        await this.emitVirtualDollarRunCompleted(
          event.playerId,
          event.virtualDollarId,
          newLevel,
          updatedDollar.currentRunWinnings,
          true // isJackpot
        );
      } else {
        // Re-pool the advanced winner for next level matching
        await this.rePoolAdvancedWinner(updatedDollar);

        // Player advanced to next level - emit VIRTUAL_DOLLAR_ADVANCED event
        await this.emitVirtualDollarAdvanced(
          event.playerId,
          event.virtualDollarId,
          event.currentLevel as BettingLevel,
          newLevel,
          updatedDollar.currentRunWinnings,
          updatedDollar.gamesInThisRun
        );
      }
    } catch (error) {
      throw new Error(
        `Winner progression failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async processLoserElimination(
    event: GameResolvedEvent
  ): Promise<void> {
    try {
      // Use factory to eliminate player - handles all validation and state management
      const updatedDollar = this.virtualDollarFactory.eliminatePlayer(
        event.loserDollarId,
        event.loserLevel as BettingLevel
      );

      if (this.loggingEnabled) {
        console.log(
          `[PlayerProgressionHandler] Loser ${event.loserId} eliminated at Level ${event.loserLevel}`
        );
      }

      // Emit VIRTUAL_DOLLAR_RUN_COMPLETED event for the loser (elimination)
      await this.emitVirtualDollarRunCompleted(
        event.loserId,
        event.loserDollarId,
        event.loserLevel as BettingLevel,
        updatedDollar.currentRunWinnings,
        false // isJackpot
      );
    } catch (error) {
      console.error(
        `[PlayerProgressionHandler] Error processing loser elimination:`,
        error
      );
      // Don't throw here - loser elimination shouldn't block winner progression
    }
  }

  /**
   * Re-pool an advanced winner for continued matching at their new level
   */
  private async rePoolAdvancedWinner(virtualDollar: any): Promise<void> {
    try {
      if (!virtualDollar || !virtualDollar.id) {
        console.warn(
          `[PlayerProgressionHandler] Skipping re-pool: missing virtual dollar id for player`
        );
        return;
      }
      // Update state from WON to POOLED for re-matching
      this.virtualDollarFactory.updateDollarState(
        virtualDollar.id,
        DollarState.POOLED
      );

      // Add back to matching pool at new level
      const addResult = await this.gameMatchingEngine.addToPool(virtualDollar);

      if (!addResult.success) {
        throw new Error(
          `Failed to re-pool advanced winner: ${addResult.error}`
        );
      }

      if (this.loggingEnabled) {
        console.log(
          `[PlayerProgressionHandler] Re-pooled advanced winner ${virtualDollar.ownerId} (${virtualDollar.id}) at level ${virtualDollar.currentLevel}`
        );
      }
    } catch (error) {
      console.error(
        `[PlayerProgressionHandler] Error re-pooling advanced winner:`,
        error
      );
      throw error; // Re-throw to trigger progression failure event
    }
  }

  /**
   * Emit VIRTUAL_DOLLAR_ADVANCED event (specific to one virtual dollar's progression)
   */
  private async emitVirtualDollarAdvanced(
    playerId: string,
    virtualDollarId: string,
    previousLevel: BettingLevel,
    newLevel: BettingLevel,
    totalWinnings: number,
    gamesWon: number
  ): Promise<void> {
    const virtualDollarAdvancedEvent: VirtualDollarAdvancedEvent = {
      type: EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED,
      timestamp: new Date(),
      playerId,
      virtualDollarId,
      previousLevel,
      currentLevel: newLevel,
      totalWinnings,
      gamesWonInRun: gamesWon,
      nextBettingAmount: this.virtualDollarFactory.calculateLevelWinnings(
        Math.min(10, newLevel + 1) as BettingLevel
      ),
    };

    await this.eventBus.emit(
      EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED,
      virtualDollarAdvancedEvent
    );

    // Also emit player-level aggregate event for total winnings update
    await this.emitPlayerTotalWinningsUpdated(
      playerId,
      virtualDollarId,
      totalWinnings,
      "VIRTUAL_DOLLAR_ADVANCED"
    );
  }

  /**
   * Emit VIRTUAL_DOLLAR_RUN_COMPLETED event (specific to one virtual dollar's run completion)
   */
  private async emitVirtualDollarRunCompleted(
    playerId: string,
    virtualDollarId: string,
    finalLevel: BettingLevel,
    totalWinnings: number,
    isJackpot: boolean
  ): Promise<void> {
    const completionType: "CASH_OUT" | "JACKPOT" | "ELIMINATION" = isJackpot
      ? "JACKPOT"
      : "ELIMINATION";

    const virtualDollarRunCompletedEvent: VirtualDollarRunCompletedEvent = {
      type: EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED,
      timestamp: new Date(),
      playerId,
      virtualDollarId,
      finalLevel,
      totalWinnings,
      completionType,
      wasSuccessful: isJackpot,
    };

    await this.eventBus.emit(
      EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED,
      virtualDollarRunCompletedEvent
    );

    // Also emit player-level aggregate event for total winnings update
    await this.emitPlayerTotalWinningsUpdated(
      playerId,
      virtualDollarId,
      totalWinnings,
      "VIRTUAL_DOLLAR_RUN_COMPLETED"
    );
  }

  /**
   * Emit PLAYER_TOTAL_WINNINGS_UPDATED event (aggregate across all virtual dollars for a player)
   */
  private async emitPlayerTotalWinningsUpdated(
    playerId: string,
    triggeringVirtualDollarId: string,
    winningsChange: number,
    triggeringEvent:
      | "VIRTUAL_DOLLAR_ADVANCED"
      | "VIRTUAL_DOLLAR_RUN_COMPLETED"
      | "CASH_OUT_COMPLETED"
  ): Promise<void> {
    // TODO: In a full implementation, we'd need to query the VirtualDollarFactory
    // to get total winnings across all of this player's virtual dollars.
    // For now, we'll emit the event with the individual virtual dollar's winnings.

    const playerTotalWinningsEvent: PlayerTotalWinningsUpdatedEvent = {
      type: EVENT_TYPES.PLAYER_TOTAL_WINNINGS_UPDATED,
      timestamp: new Date(),
      playerId,
      previousTotalWinnings: 0, // TODO: Calculate actual previous total
      newTotalWinnings: winningsChange, // TODO: Calculate actual new total
      winningsChange,
      triggeringVirtualDollarId,
      triggeringEvent,
    };

    await this.eventBus.emit(
      EVENT_TYPES.PLAYER_TOTAL_WINNINGS_UPDATED,
      playerTotalWinningsEvent
    );
  }

  /**
   * Clean up event subscriptions
   */
  dispose(): void {
    if (this.gameResolvedSubscription) {
      this.gameResolvedSubscription.unsubscribe();
      this.gameResolvedSubscription = null;
    }
    if (this.continuePlaySubscription) {
      this.continuePlaySubscription.unsubscribe();
      this.continuePlaySubscription = null;
    }
  }
}
