/**
 * PlayerProgressionHandler - Event-driven player progression and level advancement
 * Handles player progression logic extracted from PlayerManager and ProgressionManager
 */

import { EventBus, EventSubscription } from "../event-bus";
import { GameResolvedEvent, EVENT_TYPES } from "../event-types";
import {
  VirtualDollar,
  GameResult,
  BettingLevel,
} from "../../types/virtual-dollar-engine";
import { ProgressionManager } from "../../types/progression-manager";

export class PlayerProgressionHandler {
  private subscription: EventSubscription | null = null;

  constructor(
    private eventBus: EventBus,
    private progressionManager: ProgressionManager
  ) {
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    // Subscribe to GAME_RESOLVED events to handle winner progression
    this.subscription = this.eventBus.on<GameResolvedEvent>(
      EVENT_TYPES.GAME_RESOLVED,
      this.handleGameResolved.bind(this),
      10 // Higher priority to ensure we process progression before other handlers
    );
  }

  private async handleGameResolved(event: GameResolvedEvent): Promise<void> {
    try {
      // Process both winner and loser progression
      await this.processWinnerProgression(event);
      await this.processLoserElimination(event);
    } catch (error) {
      console.error(
        `[PlayerProgressionHandler] Error processing game result:`,
        error
      );

      await this.eventBus.emit(EVENT_TYPES.PLAYER_PROGRESSION_FAILED, {
        type: EVENT_TYPES.PLAYER_PROGRESSION_FAILED,
        timestamp: new Date(),
        playerId: event.winnerId,
        virtualDollarId: event.winnerDollarId,
        currentLevel: event.winnerLevel,
        reason: "Progression processing failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processWinnerProgression(
    event: GameResolvedEvent
  ): Promise<void> {
    // Create VirtualDollar object for progression processing
    const winnerDollar: VirtualDollar = {
      id: event.winnerDollarId,
      ownerId: event.winnerId,
      currentLevel: event.winnerLevel as BettingLevel,
      runId: `run-${event.winnerDollarId}`,
      serialNumber: `L${event.winnerLevel.toString().padStart(8, "0")}A`,
      currentScore: 0.75, // Winner score
      state: "IN_GAME" as any,
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true,
      potValue: event.winnerLevel, // Add the missing potValue
    };

    try {
      // Process the game result through progression manager
      const progressionState = this.progressionManager.processGameResult(
        winnerDollar,
        "win" as GameResult
      );

      if (progressionState.isComplete) {
        // Run completed (jackpot or elimination)
        await this.emitRunCompleted(
          event.winnerId,
          event.winnerDollarId,
          progressionState
        );
      } else {
        // Player advanced to next level
        await this.emitPlayerAdvanced(
          event.winnerId,
          event.winnerDollarId,
          event.winnerLevel,
          progressionState.currentLevel,
          progressionState.currentWinnings,
          progressionState.gamesWonInRun
        );

        // Note: Cash-out decision is handled by CashOutDecisionHandler
        // which listens to PLAYER_ADVANCED events
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
    // Create VirtualDollar object for the loser
    const loserDollar: VirtualDollar = {
      id: event.loserDollarId,
      ownerId: event.loserId,
      currentLevel: event.loserLevel as BettingLevel,
      runId: `run-${event.loserDollarId}`,
      serialNumber: `L${event.loserLevel.toString().padStart(8, "0")}B`,
      currentScore: 0.25, // Loser score
      state: "LOST" as any,
      createdAt: new Date(),
      gameHistory: [],
      gamesInThisRun: 0,
      currentRunWinnings: 0,
      isIndependentRun: true,
      potValue: event.loserLevel, // Add the missing potValue
    };

    try {
      // Process the loss through progression manager
      const progressionState = this.progressionManager.processGameResult(
        loserDollar,
        "loss" as GameResult
      );

      // Loser is eliminated - emit run completion
      await this.emitRunCompleted(
        event.loserId,
        event.loserDollarId,
        progressionState
      );
    } catch (error) {
      console.error(
        `[PlayerProgressionHandler] Error processing loser elimination:`,
        error
      );
      // Don't throw for loser processing errors, just log them
    }
  }

  private async emitPlayerAdvanced(
    playerId: string,
    virtualDollarId: string,
    fromLevel: number,
    toLevel: number,
    totalWinnings: number,
    gamesPlayed: number
  ): Promise<void> {
    await this.eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, {
      type: EVENT_TYPES.PLAYER_ADVANCED,
      timestamp: new Date(),
      playerId,
      virtualDollarId,
      fromLevel,
      toLevel,
      totalWinnings,
      gamesPlayed,
    });
  }

  private async emitRunCompleted(
    playerId: string,
    virtualDollarId: string,
    progressionState: any
  ): Promise<void> {
    let completionType: "CASH_OUT" | "JACKPOT" | "ELIMINATED";

    switch (progressionState.completionReason) {
      case "JACKPOT":
        completionType = "JACKPOT";
        break;
      case "CASH_OUT":
        completionType = "CASH_OUT";
        break;
      case "LOSS":
      default:
        completionType = "ELIMINATED";
        break;
    }

    await this.eventBus.emit(EVENT_TYPES.RUN_COMPLETED, {
      type: EVENT_TYPES.RUN_COMPLETED,
      timestamp: new Date(),
      playerId,
      virtualDollarId,
      completionType,
      finalLevel: progressionState.currentLevel,
      totalWinnings: progressionState.currentWinnings,
      gamesPlayed:
        progressionState.gamesWonInRun +
        (progressionState.completionReason === "LOSS" ? 1 : 0),
      wasJackpot: progressionState.completionReason === "JACKPOT",
    });
  }

  public dispose(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
