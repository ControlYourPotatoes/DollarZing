/**
 * CashOutDecisionHandler - Event-driven cash-out decision logic
 * Handles cash-out strategy-based decisions extracted from PlayerManager
 */

import { EventBus, EventSubscription } from "../event-bus";
import {
  PlayerProgressionEvent,
  CashOutDecisionEvent,
  CashOutCompletedEvent,
  ContinuePlayEvent,
  EVENT_TYPES,
} from "../event-types";
import { CashOutStrategy } from "../../types/virtual-dollar-engine";

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

  constructor(
    private eventBus: EventBus,
    private strategyManager: IStrategyManager
  ) {
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions(): void {
    // Subscribe to PLAYER_ADVANCED events to handle cash-out decisions
    this.subscription = this.eventBus.on<PlayerProgressionEvent>(
      EVENT_TYPES.PLAYER_ADVANCED,
      this.handlePlayerProgression.bind(this),
      5 // Lower priority to ensure this runs after progression processing
    );
  }

  private async handlePlayerProgression(
    event: PlayerProgressionEvent
  ): Promise<void> {
    try {
      await this.processCashOutDecision(event);
    } catch (error) {
      console.error(
        `[CashOutDecisionHandler] Error processing cash-out decision:`,
        error
      );

      await this.eventBus.emit(EVENT_TYPES.CASH_OUT_DECISION_FAILED, {
        type: EVENT_TYPES.CASH_OUT_DECISION_FAILED,
        timestamp: new Date(),
        playerId: event.playerId,
        virtualDollarId: event.virtualDollarId,
        reason: "Decision making failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processCashOutDecision(
    event: PlayerProgressionEvent
  ): Promise<void> {
    // Get player strategy
    const originalStrategy = this.strategyManager.getPlayerStrategy(
      event.playerId
    );
    let strategy = originalStrategy;

    // Use balanced as default if strategy is unknown
    if (!strategy) {
      strategy = CashOutStrategy.BALANCED;
    }

    // Special case: Level 10 (jackpot) - always cash out
    if (event.toLevel === 10) {
      await this.emitCashOutDecision(
        event,
        "CASH_OUT",
        strategy,
        "Jackpot reached - automatic cash-out"
      );
      return;
    }

    // Build decision context
    const context: CashOutDecisionContext = {
      currentLevel: event.toLevel,
      totalWinnings: event.totalWinnings,
      strategy: strategy,
      gamesPlayed: event.gamesPlayed,
      playerId: event.playerId,
      virtualDollarId: event.virtualDollarId,
    };

    // Make cash-out decision using strategy manager
    let decision: "CASH_OUT" | "CONTINUE";

    if (strategy === CashOutStrategy.BALANCED) {
      // For balanced strategy, use probabilistic decision
      const probability = this.strategyManager.getCashOutProbability(
        event.toLevel,
        strategy
      );
      decision = Math.random() < probability ? "CASH_OUT" : "CONTINUE";
    } else {
      // For other strategies, use the strategy manager's decision
      decision = this.strategyManager.makeCashOutDecision(context);
    }

    // Create reason string based on strategy and decision
    const reason = this.buildDecisionReason(
      originalStrategy,
      decision,
      event.toLevel
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
    event: PlayerProgressionEvent,
    decision: "CASH_OUT" | "CONTINUE",
    strategy: CashOutStrategy,
    reason: string
  ): Promise<void> {
    // Emit the cash-out decision event
    const decisionEvent: CashOutDecisionEvent = {
      type: EVENT_TYPES.CASH_OUT_DECISION,
      timestamp: new Date(),
      playerId: event.playerId,
      virtualDollarId: event.virtualDollarId,
      decision,
      currentLevel: event.toLevel,
      totalWinnings: event.totalWinnings,
      cashOutStrategy: strategy,
      reason,
      ...(decision === "CASH_OUT" && { amount: event.totalWinnings }),
    };

    await this.eventBus.emit(EVENT_TYPES.CASH_OUT_DECISION, decisionEvent);

    // Process the decision and emit follow-up events
    if (decision === "CASH_OUT") {
      await this.processCashOut(event);
    } else {
      await this.processContinuePlay(event);
    }
  }

  private async processCashOut(event: PlayerProgressionEvent): Promise<void> {
    try {
      // Process the cash-out using strategy manager
      const processContext: DecisionProcessContext = {
        decision: "CASH_OUT",
        currentLevel: event.toLevel,
        totalWinnings: event.totalWinnings,
        playerId: event.playerId,
        virtualDollarId: event.virtualDollarId,
      };

      const result = this.strategyManager.processDecision(processContext);

      // Emit cash-out completed event
      const completedEvent: CashOutCompletedEvent = {
        type: EVENT_TYPES.CASH_OUT_COMPLETED,
        timestamp: new Date(),
        playerId: event.playerId,
        virtualDollarId: event.virtualDollarId,
        finalLevel: result.finalLevel,
        totalWinnings: result.totalWinnings,
        cashOutAmount: result.cashOutAmount || 0,
        runCompleted: result.completed,
        wasJackpot: event.toLevel === 10,
      };

      await this.eventBus.emit(EVENT_TYPES.CASH_OUT_COMPLETED, completedEvent);
    } catch (error) {
      console.error(
        `[CashOutDecisionHandler] Error processing cash-out:`,
        error
      );
      throw error; // Re-throw to trigger error handling
    }
  }

  private async processContinuePlay(
    event: PlayerProgressionEvent
  ): Promise<void> {
    // Calculate next level potential winnings
    const nextLevel = Math.min(event.toLevel + 1, 10);
    const nextPotentialWinnings = this.calculateNextLevelWinnings(nextLevel);

    // Emit continue play event
    const continueEvent: ContinuePlayEvent = {
      type: EVENT_TYPES.CONTINUE_PLAY,
      timestamp: new Date(),
      playerId: event.playerId,
      virtualDollarId: event.virtualDollarId,
      currentLevel: event.toLevel,
      potentialWinnings: event.totalWinnings,
      nextLevel,
      nextPotentialWinnings,
    };

    await this.eventBus.emit(EVENT_TYPES.CONTINUE_PLAY, continueEvent);
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
