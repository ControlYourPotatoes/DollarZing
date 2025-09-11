/**
 * PlayerProgressionHandler - Event-driven player progression and level advancement
 * Handles player progression logic using real VirtualDollar objects from VirtualDollarManager
 */

import { EventBus, EventSubscription } from "../event-bus";
import {
  GameResolvedEvent,
  ContinuePlayEvent,
  EVENT_TYPES,
} from "../event-types";
import { BettingLevel } from "../../types/virtual-dollar-engine";
import { VirtualDollarFactory } from "../../types/factory-interfaces";

export class PlayerProgressionHandler {
  private gameResolvedSubscription: EventSubscription | null = null;
  private continuePlaySubscription: EventSubscription | null = null;

  constructor(
    private eventBus: EventBus,
    private virtualDollarFactory: VirtualDollarFactory
  ) {
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
    try {
      // Only process loser elimination - winners are processed after cash-out decision
      await this.processLoserElimination(event);
    } catch (error) {
      console.error(
        `[PlayerProgressionHandler] Error processing loser elimination:`,
        error
      );

      await this.eventBus.emit(EVENT_TYPES.PLAYER_PROGRESSION_FAILED, {
        type: EVENT_TYPES.PLAYER_PROGRESSION_FAILED,
        timestamp: new Date(),
        playerId: event.loserId,
        virtualDollarId: event.loserDollarId,
        currentLevel: event.loserLevel,
        reason: "Loser elimination failed",
        error: error instanceof Error ? error.message : String(error),
      });
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

      await this.eventBus.emit(EVENT_TYPES.PLAYER_PROGRESSION_FAILED, {
        type: EVENT_TYPES.PLAYER_PROGRESSION_FAILED,
        timestamp: new Date(),
        playerId: event.playerId,
        virtualDollarId: event.virtualDollarId,
        currentLevel: event.currentLevel,
        reason: "Winner progression failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processWinnerProgression(
    event: ContinuePlayEvent
  ): Promise<void> {
    try {
      // Calculate progression using factory
      const newLevel = Math.min(10, event.nextLevel) as BettingLevel;
      const levelWinnings =
        this.virtualDollarFactory.calculateLevelWinnings(newLevel);

      // Use factory to advance player - handles all validation and state management
      const updatedDollar = this.virtualDollarFactory.advancePlayerLevel(
        event.virtualDollarId,
        newLevel,
        levelWinnings
      );

      console.log(
        `[PlayerProgressionHandler] Winner ${event.playerId} advanced from Level ${event.currentLevel} to Level ${newLevel}, winnings: ${updatedDollar.currentRunWinnings}`
      );

      // Check if run is complete (reached Level 10 = Jackpot)
      if (newLevel >= 10) {
        await this.emitRunCompleted(
          event.playerId,
          event.virtualDollarId,
          newLevel,
          updatedDollar.currentRunWinnings,
          true // isJackpot
        );
      } else {
        // Player advanced to next level - emit PLAYER_ADVANCED event
        await this.emitPlayerAdvanced(
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

      console.log(
        `[PlayerProgressionHandler] Loser ${event.loserId} eliminated at Level ${event.loserLevel}`
      );

      // Emit RUN_COMPLETED event for the loser (elimination)
      await this.emitRunCompleted(
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
   * Emit PLAYER_ADVANCED event
   */
  private async emitPlayerAdvanced(
    playerId: string,
    virtualDollarId: string,
    previousLevel: BettingLevel,
    newLevel: BettingLevel,
    totalWinnings: number,
    gamesWon: number
  ): Promise<void> {
    await this.eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, {
      type: EVENT_TYPES.PLAYER_ADVANCED,
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
    });
  }

  /**
   * Emit RUN_COMPLETED event
   */
  private async emitRunCompleted(
    playerId: string,
    virtualDollarId: string,
    finalLevel: BettingLevel,
    totalWinnings: number,
    isJackpot: boolean
  ): Promise<void> {
    await this.eventBus.emit(EVENT_TYPES.RUN_COMPLETED, {
      type: EVENT_TYPES.RUN_COMPLETED,
      timestamp: new Date(),
      playerId,
      virtualDollarId,
      finalLevel,
      totalWinnings,
      completionType: isJackpot ? "JACKPOT" : "ELIMINATION",
      wasSuccessful: isJackpot,
    });
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
