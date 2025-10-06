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
import {
  BettingLevel,
  DollarState,
} from "../../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../../types/factory-interfaces";
import { GameMatchingEngine } from "../../core/game-matching-engine";
import type { EventDebugInterface } from "../debug";

export class PlayerProgressionHandler {
  private gameResolvedSubscription: EventSubscription | null = null;
  private continuePlaySubscription: EventSubscription | null = null;

  constructor(
    private eventBus: EventBus,
    private virtualDollarFactory: VirtualDollarFactory,
    private gameMatchingEngine: GameMatchingEngine,
    options?: { loggingEnabled?: boolean },
    private debugInterface?: EventDebugInterface,
    private verbose?: boolean
  ) {
    // Suppress unused variable warning - options kept for compatibility
    void options;
    if (this.verbose) {
      console.log("[PlayerProgressionHandler] attached");
    }
    this.setupEventSubscriptions();
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
    if (this.debugInterface) {
      console.log(
        `[PlayerProgressionHandler] handleGameResolved: game ${event.gameId}, loser ${event.loserId}, level ${event.loserLevel}`
      );
    }
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

      void this.eventBus
        .emit(
          EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
          progressionFailedEvent
        )
        .catch((emitError) =>
          console.error(
            `[PlayerProgressionHandler] Failed to emit VIRTUAL_DOLLAR_PROGRESSION_FAILED (loser):`,
            emitError
          )
        );
    }
  }

  private async handleContinuePlay(event: ContinuePlayEvent): Promise<void> {
    if (this.debugInterface) {
      console.log(
        `[PlayerProgressionHandler] handleContinuePlay: player ${event.playerId}, level ${event.currentLevel}`
      );
    }
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

      void this.eventBus
        .emit(
          EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
          progressionFailedEvent
        )
        .catch((emitError) =>
          console.error(
            `[PlayerProgressionHandler] Failed to emit VIRTUAL_DOLLAR_PROGRESSION_FAILED (winner):`,
            emitError
          )
        );
    }
  }

  private async processWinnerProgression(
    event: ContinuePlayEvent
  ): Promise<void> {
    try {
      const virtualDollarId = event.virtualDollarId;
      if (!virtualDollarId) {
        throw new Error(
          `Missing virtualDollarId in CONTINUE_PLAY (player=${event.playerId}, level=${event.currentLevel})`
        );
      }

      const currentDollar = this.virtualDollarFactory.getDollar(
        virtualDollarId
      );
      if (!currentDollar) {
        throw new Error(
          `Winner progression failed: virtual dollar ${virtualDollarId} not found`
        );
      }

      if (currentDollar.state === DollarState.LOST) {
        throw new Error(
          `Winner progression failed: dollar ${virtualDollarId} already marked as LOST (state=${currentDollar.state})`
        );
      }

      // Use the level provided in the event to avoid stale factory state
      const currentLevel = event.currentLevel as BettingLevel;
      if (currentLevel >= 10) {
        await this.emitVirtualDollarRunCompleted(
          event.playerId,
          virtualDollarId,
          currentLevel,
          currentDollar.currentRunWinnings,
          true
        );
        return;
      }

      const nextLevel = (currentLevel + 1) as BettingLevel;
      // Winnings already accumulated in factory; do not add again here
      const advancedDollar = this.virtualDollarFactory.advancePlayerLevel(
        virtualDollarId,
        nextLevel,
        0
      );

      const addResult = this.gameMatchingEngine.addToPool(advancedDollar);
      if (addResult instanceof Promise) {
        await addResult;
      }

      await this.emitVirtualDollarAdvanced(
        event.playerId,
        virtualDollarId,
        currentLevel,
        nextLevel,
        advancedDollar.currentRunWinnings,
        advancedDollar.gamesInThisRun
      );
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

      if (this.debugInterface) {
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
      const progressionFailedEvent: VirtualDollarProgressionFailedEvent = {
        type: EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
        timestamp: new Date(),
        playerId: event.loserId,
        virtualDollarId: event.loserDollarId,
        currentLevel: event.loserLevel,
        reason: "Loser elimination failed",
        error: error instanceof Error ? error.message : String(error),
      };
      void this.eventBus.emit(
        EVENT_TYPES.VIRTUAL_DOLLAR_PROGRESSION_FAILED,
        progressionFailedEvent
      );
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

    this.eventBus
      .emit(EVENT_TYPES.VIRTUAL_DOLLAR_ADVANCED, virtualDollarAdvancedEvent)
      .catch((error) =>
        console.error(
          "[PlayerProgressionHandler] Failed to emit VIRTUAL_DOLLAR_ADVANCED:",
          error
        )
      );

    // Also emit player-level aggregate event for total winnings update
    this.emitPlayerTotalWinningsUpdated(
      playerId,
      virtualDollarId,
      totalWinnings,
      "VIRTUAL_DOLLAR_ADVANCED"
    ).catch((error) =>
      console.error(
        "[PlayerProgressionHandler] Failed to emit PLAYER_TOTAL_WINNINGS_UPDATED:",
        error
      )
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

    void this.eventBus
      .emit(
        EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED,
        virtualDollarRunCompletedEvent
      )
      .catch((error) =>
        console.error(
          "[PlayerProgressionHandler] Failed to emit VIRTUAL_DOLLAR_RUN_COMPLETED:",
          error
        )
      );

    // Also emit player-level aggregate event for total winnings update
    void this.emitPlayerTotalWinningsUpdated(
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

    void this.eventBus
      .emit(EVENT_TYPES.PLAYER_TOTAL_WINNINGS_UPDATED, playerTotalWinningsEvent)
      .catch((error) =>
        console.error(
          "[PlayerProgressionHandler] Failed to emit PLAYER_TOTAL_WINNINGS_UPDATED:",
          error
        )
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
