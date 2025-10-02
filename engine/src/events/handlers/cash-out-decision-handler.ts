/**
 * CashOutDecisionHandler - Event-driven cash-out decision logic
 * Handles cash-out strategy-based decisions extracted from PlayerManager
 */

import { EventBus, EventSubscription } from "../event-bus";
import {
  GameResolvedEvent,
  CashOutDecisionEvent,
  CashOutCompletedEvent,
  ContinuePlayEvent,
  EVENT_TYPES,
} from "../event-types";
import { CashOutStrategy } from "../../types/virtual-dollar-engine";
import type { EventDebugInterface } from "../debug/index";

/**
 * Strategy Manager interface for cash-out decision logic
 */
export interface IStrategyManager {
  getPlayerStrategy(playerId: string): CashOutStrategy | null;
  makeCashOutDecision(context: CashOutDecisionContext): "CASH_OUT" | "CONTINUE";
  getCashOutProbability(level: number, strategy: CashOutStrategy): number;
  processDecision(context: DecisionProcessContext): DecisionResult;
}

/**
 * Cash-out decision context used by strategy manager
 */
export interface CashOutDecisionContext {
  currentLevel: number;
  totalWinnings: number;
  strategy: CashOutStrategy;
  gamesPlayed: number;
  playerId: string;
  virtualDollarId: string;
  consecutiveWins: number;
}

/**
 * Decision process context for final cash-out processing
 */
export interface DecisionProcessContext {
  decision: "CASH_OUT" | "CONTINUE";
  currentLevel: number;
  totalWinnings: number;
  playerId: string;
  virtualDollarId: string;
}

/**
 * Decision processing result
 */
export interface DecisionResult {
  finalLevel: number;
  totalWinnings: number;
  cashOutAmount?: number;
  charityContribution?: number;
  completed: boolean;
}

export class CashOutDecisionHandler {
  private subscription: EventSubscription | null = null;
  private debugInterface?: EventDebugInterface | undefined;

  constructor(
    private eventBus: EventBus,
    private strategyManager: IStrategyManager,
    debugInterface?: EventDebugInterface
  ) {
    this.debugInterface = debugInterface;
    console.log(
      "[CashOutDecisionHandler] attached, debugInterface:",
      !!debugInterface
    );
    this.setupEventSubscriptions();
    console.log("[CashOutDecisionHandler] attached");
  }

  private setupEventSubscriptions(): void {
    // Subscribe to GAME_RESOLVED events to handle cash-out decisions
    this.subscription = this.eventBus.on<GameResolvedEvent>(
      EVENT_TYPES.GAME_RESOLVED,
      this.handleGameResolved.bind(this),
      15 // Higher priority to ensure cash-out decision happens before progression (15 > 10)
    );
  }

  private async handleGameResolved(event: GameResolvedEvent): Promise<void> {
    console.log(
      `[CashOutDecisionHandler] handleGameResolved: game ${event.gameId}, winner ${event.winnerId}, level ${event.winnerLevel}`
    );
    console.log(
      `[CashOutDecisionHandler] handleGameResolved: game ${event.gameId}, winner ${event.winnerId}, level ${event.winnerLevel}`
    );
    try {
      // Only process cash-out decisions for winners
      if (event.gameResult === "WIN") {
        // Force cash-out at level 10 (jackpot level)
        // Check if winner will reach level 10 after this win
        const nextLevel = event.winnerLevel + 1;
        if (nextLevel > 10) {
          await this.processCashOutDecision(event);
          return;
        }

        await this.processCashOutDecision(event);
      }
    } catch (error) {
      console.error(
        `[CashOutDecisionHandler] Error processing cash-out decision:`,
        error
      );

      void this.eventBus
        .emit(EVENT_TYPES.CASH_OUT_DECISION_FAILED, {
          type: EVENT_TYPES.CASH_OUT_DECISION_FAILED,
          timestamp: new Date(),
          playerId: event.winnerId,
          virtualDollarId: event.winnerDollarId,
          reason: "Decision making failed",
          error: error instanceof Error ? error.message : String(error),
        })
        .catch((emitError) =>
          console.error(
            `[CashOutDecisionHandler] Failed to emit CASH_OUT_DECISION_FAILED:`,
            emitError
          )
        );
    }
  }

  private async processCashOutDecision(
    event: GameResolvedEvent
  ): Promise<void> {
    // Get player strategy
    const originalStrategy = this.strategyManager.getPlayerStrategy(
      event.winnerId
    );
    let strategy = originalStrategy;

    // Use balanced as default if strategy is unknown
    if (!strategy) {
      strategy = CashOutStrategy.BALANCED;
    }

    // Special case: Level 10 (jackpot) - always cash out
    if (event.winnerLevel === 10) {
      await this.emitCashOutDecision(
        event,
        "CASH_OUT",
        strategy,
        "Jackpot reached - automatic cash-out"
      );
      return;
    }

    // Build decision context using current level (before advancement)
    const context: CashOutDecisionContext = {
      currentLevel: event.winnerLevel,
      totalWinnings: event.winnings,
      strategy: strategy,
      gamesPlayed: 1, // From the resolved game
      playerId: event.winnerId,
      virtualDollarId: event.winnerDollarId,
      consecutiveWins: event.winnerLevel - 1, // Each level advancement represents a consecutive win
    };

    // Make cash-out decision using strategy manager
    let decision: "CASH_OUT" | "CONTINUE";

    if (strategy === CashOutStrategy.BALANCED) {
      // Balanced strategy - moderate cash-out probability
      const cashOutProbability = Math.min(0.4 + event.winnerLevel * 0.04, 0.7);
      if (this.debugInterface) {
        console.log(
          `DEBUG: [CashOutDecisionHandler] CashOut Probability - Balanced: ${(
            cashOutProbability * 100
          ).toFixed(2)}% at level ${event.winnerLevel} (player: ${
            event.winnerId
          })`
        );
      }
      decision = Math.random() < cashOutProbability ? "CASH_OUT" : "CONTINUE";
    } else if (strategy === CashOutStrategy.AGGRESSIVE) {
      // Aggressive (high-risk) strategy prefers to continue - LOW cash-out probability
      // Start at 5% cash-out at level 1, increase to max 40% at level 12+
      let cashOutProbability = Math.min(0.05 + event.winnerLevel * 0.015, 0.4);

      // Risk tolerance multiplier: reduce cashout probability for winning streaks
      // Stronger reduction at higher levels to encourage reaching level 10
      let multiplier = 0.4; // Base 60% reduction
      if (context.consecutiveWins >= 3 && event.winnerLevel >= 7) {
        multiplier = 0.2; // 80% reduction at levels 7+
      }
      if (context.consecutiveWins >= 3) {
        cashOutProbability *= multiplier;
      }

      if (this.debugInterface) {
        console.log(
          `DEBUG: [CashOutDecisionHandler] CashOut Probability - Aggressive: ${(
            cashOutProbability * 100
          ).toFixed(2)}% at level ${event.winnerLevel} (consecutive wins: ${
            context.consecutiveWins
          }, multiplier: ${multiplier}) (player: ${event.winnerId})`
        );
      }
      decision = Math.random() < cashOutProbability ? "CASH_OUT" : "CONTINUE";
    } else if (strategy === CashOutStrategy.CONSERVATIVE) {
      // Conservative (low-risk) strategy cashes out early - HIGH cash-out probability
      const cashOutProbability = Math.min(0.7 + event.winnerLevel * 0.04, 0.8);
      if (this.debugInterface) {
        console.log(
          `DEBUG: [CashOutDecisionHandler] CashOut Probability - Conservative: ${(
            cashOutProbability * 100
          ).toFixed(2)}% at level ${event.winnerLevel} (player: ${
            event.winnerId
          })`
        );
      }
      decision = Math.random() < cashOutProbability ? "CASH_OUT" : "CONTINUE";
    } else {
      // Fallback to strategy manager
      decision = this.strategyManager.makeCashOutDecision(context);
    }

    console.log(
      `[CashOutDecisionHandler] Winner ${event.winnerId} at level ${event.winnerLevel} with strategy ${strategy} decided to ${decision}`
    );

    // Create reason string based on strategy and decision
    const reason = this.buildDecisionReason(
      originalStrategy,
      decision,
      event.winnerLevel
    );

    // Emit the decision event
    await this.emitCashOutDecision(event, decision, strategy, reason);
  }

  private buildDecisionReason(
    strategy: CashOutStrategy | null,
    decision: "CASH_OUT" | "CONTINUE",
    level: number
  ): string {
    const baseReason =
      strategy === CashOutStrategy.CONSERVATIVE
        ? "Conservative strategy"
        : strategy === CashOutStrategy.AGGRESSIVE
        ? "Aggressive strategy"
        : strategy === CashOutStrategy.BALANCED
        ? "Balanced strategy"
        : "Default strategy";

    const decisionText =
      decision === "CASH_OUT"
        ? "prefers to secure winnings"
        : "chooses to continue playing";

    return `${baseReason} ${decisionText} at level ${level}`;
  }

  private async emitCashOutDecision(
    event: GameResolvedEvent,
    decision: "CASH_OUT" | "CONTINUE",
    strategy: CashOutStrategy,
    reason: string
  ): Promise<void> {
    // Emit the cash-out decision event
    const decisionEvent: CashOutDecisionEvent = {
      type: EVENT_TYPES.CASH_OUT_DECISION,
      timestamp: new Date(),
      playerId: event.winnerId,
      virtualDollarId: event.winnerDollarId,
      decision,
      currentLevel: event.winnerLevel,
      totalWinnings: event.winnings,
      cashOutStrategy: strategy,
      reason,
      ...(decision === "CASH_OUT" && { amount: event.winnings }),
    };

    this.eventBus
      .emit(EVENT_TYPES.CASH_OUT_DECISION, decisionEvent)
      .catch((error) =>
        console.error(
          "[CashOutDecisionHandler] Failed to emit CASH_OUT_DECISION:",
          error
        )
      );

    // Process the decision and emit follow-up events
    if (decision === "CASH_OUT") {
      await this.processCashOut(event);
    } else {
      await this.processContinuePlay(event);
    }
  }

  private async processCashOut(event: GameResolvedEvent): Promise<void> {
    try {
      // Process the cash-out using strategy manager
      const processContext: DecisionProcessContext = {
        decision: "CASH_OUT",
        currentLevel: event.winnerLevel,
        totalWinnings: event.winnings,
        playerId: event.winnerId,
        virtualDollarId: event.winnerDollarId,
      };

      const result = this.strategyManager.processDecision(processContext);

      // Emit cash-out completed event
      const completedEvent: CashOutCompletedEvent = {
        type: EVENT_TYPES.CASH_OUT_COMPLETED,
        timestamp: new Date(),
        playerId: event.winnerId,
        virtualDollarId: event.winnerDollarId,
        finalLevel: result.finalLevel,
        totalWinnings: result.totalWinnings,
        cashOutAmount: result.cashOutAmount || 0,
        runCompleted: result.completed,
        wasJackpot: event.winnerLevel === 10,
      };

      this.eventBus
        .emit(EVENT_TYPES.CASH_OUT_COMPLETED, completedEvent)
        .catch((error) =>
          console.error(
            "[CashOutDecisionHandler] Failed to emit CASH_OUT_COMPLETED:",
            error
          )
        );

      // Also emit VIRTUAL_DOLLAR_RUN_COMPLETED since cash-out is a type of run completion
      const runCompletedEvent = {
        type: EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED,
        timestamp: new Date(),
        playerId: event.winnerId,
        virtualDollarId: event.winnerDollarId,
        finalLevel: result.finalLevel,
        totalWinnings: result.totalWinnings,
        completionType: "CASH_OUT" as const,
        wasSuccessful: true,
      };

      this.eventBus
        .emit(EVENT_TYPES.VIRTUAL_DOLLAR_RUN_COMPLETED, runCompletedEvent)
        .catch((error) =>
          console.error(
            "[CashOutDecisionHandler] Failed to emit VIRTUAL_DOLLAR_RUN_COMPLETED:",
            error
          )
        );
    } catch (error) {
      console.error(
        `[CashOutDecisionHandler] Error processing cash-out:`,
        error
      );
      throw error; // Re-throw to trigger error handling
    }
  }

  private async processContinuePlay(event: GameResolvedEvent): Promise<void> {
    // Don't emit CONTINUE_PLAY for level 10 players - they should have cashed out
    if (event.winnerLevel >= 10) {
      console.warn(
        `[CashOutDecisionHandler] Attempted to continue play at level ${event.winnerLevel} - this should not happen`
      );
      return;
    }

    // Calculate next level potential winnings
    const nextLevel = Math.min(event.winnerLevel + 1, 10);
    const nextPotentialWinnings = this.calculateNextLevelWinnings(nextLevel);

    // Emit continue play event
    const continueEvent: ContinuePlayEvent = {
      type: EVENT_TYPES.CONTINUE_PLAY,
      timestamp: new Date(),
      playerId: event.winnerId,
      virtualDollarId: event.winnerDollarId,
      currentLevel: event.winnerLevel,
      potentialWinnings: event.winnings,
      nextLevel,
      nextPotentialWinnings,
    };

    this.eventBus
      .emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent)
      .catch((error) =>
        console.error(
          "[CashOutDecisionHandler] Failed to emit CONTINUE_PLAY:",
          error
        )
      );
  }

  private calculateNextLevelWinnings(level: number): number {
    // Based on game rules: betting levels are [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
    // Winnings formula: betting_amount × 1.8
    const bettingLevels = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
    const bettingAmount = bettingLevels[level - 1] || 512;
    return bettingAmount * 1.8;
  }

  /**
   * Dispose of the handler and clean up subscriptions
   */
  dispose(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
