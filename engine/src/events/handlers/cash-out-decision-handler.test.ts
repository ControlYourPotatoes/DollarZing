import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../event-bus";
import { CashOutDecisionHandler } from "./cash-out-decision-handler";
import { PlayerProgressionEvent, EVENT_TYPES } from "../event-types";
import { CashOutStrategy } from "../../types/virtual-dollar-engine";

describe("CashOutDecisionHandler", () => {
  let eventBus: EventBus;
  let handler: CashOutDecisionHandler;
  let mockStrategyManager: any;

  beforeEach(() => {
    eventBus = new EventBus();

    // Mock StrategyManager for cash-out decision logic
    mockStrategyManager = {
      getPlayerStrategy: vi.fn(),
      makeCashOutDecision: vi.fn(),
      getCashOutProbability: vi.fn(),
      processDecision: vi.fn(),
    };

    handler = new CashOutDecisionHandler(eventBus, mockStrategyManager);
  });

  afterEach(() => {
    handler.dispose();
    eventBus.dispose();
  });

  describe("Strategy-Based Decisions", () => {
    it("should make conservative cash-out decision at level 3", async () => {
      mockStrategyManager.getPlayerStrategy.mockReturnValue(
        CashOutStrategy.CONSERVATIVE
      );
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CASH_OUT");

      const decisionSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CASH_OUT_DECISION,
        decisionSpy
      );

      const playerAdvancedEvent: PlayerProgressionEvent = {
        type: "PLAYER_ADVANCED",
        timestamp: new Date(),
        playerId: "conservative-player",
        virtualDollarId: "dollar-conservative",
        previousLevel: 2,
        currentLevel: 3,
        totalWinnings: 7.2,
        gamesWonInRun: 3,
        nextBettingAmount: 1.0,
      };

      await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);

      subscription.unsubscribe();

      expect(mockStrategyManager.getPlayerStrategy).toHaveBeenCalledWith(
        "conservative-player"
      );
      expect(mockStrategyManager.makeCashOutDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          currentLevel: 3,
          totalWinnings: 7.2,
          strategy: CashOutStrategy.CONSERVATIVE,
        })
      );

      expect(decisionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CASH_OUT_DECISION",
          playerId: "conservative-player",
          virtualDollarId: "dollar-conservative",
          decision: "CASH_OUT",
          currentLevel: 3,
          totalWinnings: 7.2,
          cashOutStrategy: CashOutStrategy.CONSERVATIVE,
          reason: expect.stringContaining("Conservative strategy"),
        })
      );
    });

    it("should make aggressive continue decision at level 7", async () => {
      mockStrategyManager.getPlayerStrategy.mockReturnValue(
        CashOutStrategy.AGGRESSIVE
      );
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CONTINUE");

      const decisionSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CASH_OUT_DECISION,
        decisionSpy
      );

      const playerAdvancedEvent: PlayerProgressionEvent = {
        type: "PLAYER_ADVANCED",
        timestamp: new Date(),
        playerId: "aggressive-player",
        virtualDollarId: "dollar-aggressive",
        previousLevel: 6,
        currentLevel: 7,
        totalWinnings: 115.2,
        gamesWonInRun: 7,
        nextBettingAmount: 1.0,
      };

      await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);

      subscription.unsubscribe();

      expect(decisionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: "CONTINUE",
          cashOutStrategy: CashOutStrategy.AGGRESSIVE,
          reason: expect.stringContaining("Aggressive strategy"),
        })
      );
    });

    it("should handle balanced strategy with probabilistic decisions", async () => {
      mockStrategyManager.getPlayerStrategy.mockReturnValue(
        CashOutStrategy.BALANCED
      );
      mockStrategyManager.getCashOutProbability.mockReturnValue(0.3); // 30% chance
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CONTINUE");

      // Mock Math.random to return a value that will result in CONTINUE (0.3 < 0.5)
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.5); // This will make Math.random() < 0.3 return false, so CONTINUE

      const decisionSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CASH_OUT_DECISION,
        decisionSpy
      );

      const playerAdvancedEvent: PlayerProgressionEvent = {
        type: "PLAYER_ADVANCED",
        timestamp: new Date(),
        playerId: "balanced-player",
        virtualDollarId: "dollar-balanced",
        previousLevel: 4,
        currentLevel: 5,
        totalWinnings: 28.8,
        gamesWonInRun: 5,
        nextBettingAmount: 1.0,
      };

      await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);

      subscription.unsubscribe();

      // Restore Math.random
      Math.random = originalRandom;

      expect(mockStrategyManager.getCashOutProbability).toHaveBeenCalledWith(
        5,
        CashOutStrategy.BALANCED
      );
      expect(decisionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: "CONTINUE",
          cashOutStrategy: CashOutStrategy.BALANCED,
        })
      );
    });
  });

  describe("Cash-Out and Continue-Play Events", () => {
    it("should emit cash-out completed event when player cashes out", async () => {
      mockStrategyManager.getPlayerStrategy.mockReturnValue(
        CashOutStrategy.CONSERVATIVE
      );
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CASH_OUT");
      mockStrategyManager.processDecision.mockReturnValue({
        finalLevel: 4,
        totalWinnings: 14.4,
        cashOutAmount: 14.4 * 0.9, // After charity deduction
        charityContribution: 14.4 * 0.1,
        completed: true,
      });

      const cashOutCompletedSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CASH_OUT_COMPLETED,
        cashOutCompletedSpy
      );

      const playerAdvancedEvent: PlayerProgressionEvent = {
        type: "PLAYER_ADVANCED",
        timestamp: new Date(),
        playerId: "cashout-player",
        virtualDollarId: "dollar-cashout",
        previousLevel: 3,
        currentLevel: 4,
        totalWinnings: 14.4,
        gamesWonInRun: 4,
        nextBettingAmount: 1.0,
      };

      await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);

      subscription.unsubscribe();

      expect(cashOutCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CASH_OUT_COMPLETED",
          playerId: "cashout-player",
          virtualDollarId: "dollar-cashout",
          finalLevel: 4,
          totalWinnings: 14.4,
          cashOutAmount: 12.96,
          runCompleted: true,
        })
      );
    });

    it("should emit continue play event when player continues", async () => {
      mockStrategyManager.getPlayerStrategy.mockReturnValue(
        CashOutStrategy.AGGRESSIVE
      );
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CONTINUE");

      const continuePlaySpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CONTINUE_PLAY,
        continuePlaySpy
      );

      const playerAdvancedEvent: PlayerProgressionEvent = {
        type: "PLAYER_ADVANCED",
        timestamp: new Date(),
        playerId: "continue-player",
        virtualDollarId: "dollar-continue",
        previousLevel: 5,
        currentLevel: 6,
        totalWinnings: 57.6,
        gamesWonInRun: 6,
        nextBettingAmount: 1.0,
      };

      await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);

      subscription.unsubscribe();

      expect(continuePlaySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CONTINUE_PLAY",
          playerId: "continue-player",
          virtualDollarId: "dollar-continue",
          currentLevel: 6,
          potentialWinnings: 57.6,
          nextLevel: 7,
          nextPotentialWinnings: 115.2,
        })
      );
    });
  });

  describe("Complex Decision Scenarios and Edge Cases", () => {
    it("should handle jackpot level (10) - always cash out", async () => {
      mockStrategyManager.getPlayerStrategy.mockReturnValue(
        CashOutStrategy.AGGRESSIVE
      );
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CASH_OUT"); // Forced at level 10

      const decisionSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CASH_OUT_DECISION,
        decisionSpy
      );

      const playerAdvancedEvent: PlayerProgressionEvent = {
        type: "PLAYER_ADVANCED",
        timestamp: new Date(),
        playerId: "jackpot-player",
        virtualDollarId: "dollar-jackpot",
        previousLevel: 9,
        currentLevel: 10,
        totalWinnings: 1024, // Jackpot amount
        gamesWonInRun: 10,
        nextBettingAmount: 1.0,
      };

      await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);

      subscription.unsubscribe();

      expect(decisionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: "CASH_OUT",
          currentLevel: 10,
          totalWinnings: 1024,
          reason: expect.stringContaining("Jackpot reached"),
        })
      );
    });

    it("should handle decision making failure gracefully", async () => {
      mockStrategyManager.getPlayerStrategy.mockReturnValue(
        CashOutStrategy.CONSERVATIVE
      );
      mockStrategyManager.makeCashOutDecision.mockImplementation(() => {
        throw new Error("Strategy calculation failed");
      });
      // Mock processDecision to return a proper result for CONTINUE decisions
      mockStrategyManager.processDecision.mockReturnValue({
        finalLevel: 3,
        totalWinnings: 7.2,
        completed: false,
      });

      const errorSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CASH_OUT_DECISION_FAILED,
        errorSpy
      );

      const playerAdvancedEvent: PlayerProgressionEvent = {
        type: "PLAYER_ADVANCED",
        timestamp: new Date(),
        playerId: "error-player",
        virtualDollarId: "dollar-error",
        previousLevel: 2,
        currentLevel: 3,
        totalWinnings: 7.2,
        gamesWonInRun: 3,
        nextBettingAmount: 1.0,
      };

      await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);

      subscription.unsubscribe();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CASH_OUT_DECISION_FAILED",
          playerId: "error-player",
          virtualDollarId: "dollar-error",
          reason: "Decision making failed",
          error: "Strategy calculation failed",
        })
      );
    });

    it("should handle unknown player strategies with default behavior", async () => {
      mockStrategyManager.getPlayerStrategy.mockReturnValue(null);
      mockStrategyManager.makeCashOutDecision.mockReturnValue("CONTINUE"); // Default behavior

      const decisionSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CASH_OUT_DECISION,
        decisionSpy
      );

      const playerAdvancedEvent: PlayerProgressionEvent = {
        type: "PLAYER_ADVANCED",
        timestamp: new Date(),
        playerId: "unknown-player",
        virtualDollarId: "dollar-unknown",
        previousLevel: 1,
        currentLevel: 2,
        totalWinnings: 3.6,
        gamesWonInRun: 2,
        nextBettingAmount: 1.0,
      };

      await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);

      subscription.unsubscribe();

      expect(decisionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: "CONTINUE",
          cashOutStrategy: CashOutStrategy.BALANCED, // Default fallback
          reason: expect.stringContaining("Default strategy"),
        })
      );
    });
  });

  describe("Integration with Player Strategy Configurations", () => {
    it("should integrate with existing player strategy data", async () => {
      // Mock player with specific strategy configuration
      mockStrategyManager.getPlayerStrategy.mockReturnValue(
        CashOutStrategy.CONSERVATIVE
      );
      mockStrategyManager.makeCashOutDecision.mockImplementation(
        (context: any) => {
          // Conservative strategy: high probability of cashing out at lower levels
          if (context.currentLevel >= 3) return "CASH_OUT";
          return "CONTINUE";
        }
      );

      const decisionSpy = vi.fn();
      const subscription = eventBus.on(
        EVENT_TYPES.CASH_OUT_DECISION,
        decisionSpy
      );

      // Test multiple levels for the same player
      const levels = [
        { fromLevel: 1, toLevel: 2, winnings: 3.6 },
        { fromLevel: 2, toLevel: 3, winnings: 7.2 },
      ];

      for (const level of levels) {
        const playerAdvancedEvent: PlayerProgressionEvent = {
          type: "PLAYER_ADVANCED",
          timestamp: new Date(),
          playerId: "strategy-test-player",
          virtualDollarId: `dollar-${level.toLevel}`,
          previousLevel: level.fromLevel,
          currentLevel: level.toLevel,
          totalWinnings: level.winnings,
          gamesWonInRun: level.toLevel,
          nextBettingAmount: 1.0,
        };

        await eventBus.emit(EVENT_TYPES.PLAYER_ADVANCED, playerAdvancedEvent);
      }

      subscription.unsubscribe();

      // First level: CONTINUE
      expect(decisionSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          decision: "CONTINUE",
          currentLevel: 2,
        })
      );

      // Second level: CASH_OUT (conservative strategy kicks in at level 3)
      expect(decisionSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          decision: "CASH_OUT",
          currentLevel: 3,
        })
      );
    });
  });
});
