import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../event-bus";
import { RevenueTrackingHandler } from "./revenue-tracking-handler";
import { 
  GameResolvedEvent,
  CashOutCompletedEvent,
  RevenueGameProcessedEvent,
  RevenueCashOutProcessedEvent,
  RevenueUpdateEvent,
  EVENT_TYPES 
} from "../event-types";

describe("RevenueTrackingHandler", () => {
  let eventBus: EventBus;
  let handler: RevenueTrackingHandler;
  let mockRevenueCalculator: any;

  beforeEach(() => {
    eventBus = new EventBus();

    // Mock RevenueCalculator for revenue operations
    mockRevenueCalculator = {
      processGameRevenue: vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      }),
      processCashOut: vi.fn().mockReturnValue({
        playerAmount: 8.5,
        charityAmount: 1.5,
        validation: {
          isValid: true,
          errors: [],
          warnings: []
        }
      }),
      getRevenueStream: vi.fn().mockReturnValue({
        platformClickRevenue: 2.4,
        charityContributions: 15.0,
        playerWinnings: 85.0,
        totalGames: 12,
        totalCashOuts: 100.0,
        averageCashOutAmount: 10.0,
        charityPercentage: 0.15
      }),
      generateRevenueReport: vi.fn().mockReturnValue({
        summary: {
          platformClickRevenue: 2.4,
          charityContributions: 15.0,
          playerWinnings: 85.0,
          totalGames: 12,
          totalCashOuts: 100.0,
          averageCashOutAmount: 10.0,
          charityPercentage: 0.15
        },
        breakdown: {
          averageRevenuePerGame: 0.2,
          totalVolume: 102.4,
          platformMargin: 2.34,
          charityImpact: 15.0
        },
        validation: {
          isValid: true,
          errors: [],
          warnings: []
        }
      }),
      validateAmount: vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      }),
      setCharityPercentage: vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      })
    };

    handler = new RevenueTrackingHandler(eventBus, mockRevenueCalculator);
  });

  afterEach(() => {
    handler.dispose();
    eventBus.dispose();
  });

  describe("Financial Event Processing", () => {
    it("should process game revenue from GAME_RESOLVED events", async () => {
      const gameEvent: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "game-revenue-123",
        winnerId: "player-winner",
        loserId: "player-loser",
        winnerLevel: 3,
        loserLevel: 2,
        winnerDollarId: "dollar-winner",
        loserDollarId: "dollar-loser",
        winnings: 7.2,
        gameResult: "WIN",
      };

      // Mock game session for revenue calculator
      const mockGameSession = {
        id: "game-revenue-123",
        timestamp: new Date(),
        platformFee: 0.2,
        winnings: 7.2,
        dollar1: { id: "dollar-winner" },
        dollar2: { id: "dollar-loser" },
        winner: { id: "player-winner" },
        loser: { id: "player-loser" }
      };

      // Create spy for revenue game processed event
      const revenueGameSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.REVENUE_GAME_PROCESSED, revenueGameSpy);

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);

      // Verify revenue calculator was called with proper game session
      expect(mockRevenueCalculator.processGameRevenue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "game-revenue-123",
          platformFee: 0.2,
          winnings: 7.2
        })
      );

      // Verify revenue game processed event was emitted
      expect(revenueGameSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "REVENUE_GAME_PROCESSED",
          gameId: "game-revenue-123",
          gameRevenue: 0.2,
          platformRevenue: 0.2,
          charityContribution: 0,
          totalGameRevenue: 0.2
        })
      );

      subscription.unsubscribe();
    });

    it("should process cash-out revenue from CASH_OUT_COMPLETED events", async () => {
      const cashOutEvent: CashOutCompletedEvent = {
        type: "CASH_OUT_COMPLETED",
        timestamp: new Date(),
        playerId: "cashout-player",
        virtualDollarId: "dollar-cashout",
        finalLevel: 4,
        totalWinnings: 14.4,
        cashOutAmount: 10.0,
        runCompleted: true,
        wasJackpot: false,
      };

      // Create spy for revenue cash-out processed event
      const revenueCashOutSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.REVENUE_CASH_OUT_PROCESSED, revenueCashOutSpy);

      await eventBus.emit(EVENT_TYPES.CASH_OUT_COMPLETED, cashOutEvent);

      // Verify revenue calculator processed the cash-out
      expect(mockRevenueCalculator.processCashOut).toHaveBeenCalledWith(10.0);

      // Verify revenue cash-out processed event was emitted
      expect(revenueCashOutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "REVENUE_CASH_OUT_PROCESSED",
          playerId: "cashout-player",
          virtualDollarId: "dollar-cashout",
          cashOutAmount: 10.0,
          playerWinnings: 8.5,
          totalPlayerWinnings: 85.0
        })
      );

      subscription.unsubscribe();
    });

    it("should handle multiple concurrent revenue events", async () => {
      const gameEvent1: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "game-1",
        winnerId: "player-1",
        loserId: "player-2",
        winnerLevel: 2,
        loserLevel: 1,
        winnerDollarId: "dollar-1",
        loserDollarId: "dollar-2",
        winnings: 3.6,
        gameResult: "WIN",
      };

      const gameEvent2: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "game-2",
        winnerId: "player-3",
        loserId: "player-4",
        winnerLevel: 3,
        loserLevel: 2,
        winnerDollarId: "dollar-3",
        loserDollarId: "dollar-4",
        winnings: 7.2,
        gameResult: "WIN",
      };

      const cashOutEvent: CashOutCompletedEvent = {
        type: "CASH_OUT_COMPLETED",
        timestamp: new Date(),
        playerId: "player-5",
        virtualDollarId: "dollar-5",
        finalLevel: 3,
        totalWinnings: 7.2,
        cashOutAmount: 6.0,
        runCompleted: true,
        wasJackpot: false,
      };

      // Emit all events concurrently
      await Promise.all([
        eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent1),
        eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent2),
        eventBus.emit(EVENT_TYPES.CASH_OUT_COMPLETED, cashOutEvent)
      ]);

      // Verify all revenue processing calls were made
      expect(mockRevenueCalculator.processGameRevenue).toHaveBeenCalledTimes(2);
      expect(mockRevenueCalculator.processCashOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("Revenue Tracking and Accumulation", () => {
    it("should track cumulative revenue across multiple events", async () => {
      // Update mock to return progressive totals
      let totalGames = 0;
      let totalRevenue = 0;

      mockRevenueCalculator.processGameRevenue.mockImplementation(() => {
        totalGames++;
        totalRevenue += 0.2;
        return { isValid: true, errors: [], warnings: [] };
      });

      mockRevenueCalculator.getRevenueStream.mockImplementation(() => ({
        platformClickRevenue: totalRevenue,
        charityContributions: 5.0,
        playerWinnings: 50.0,
        totalGames: totalGames,
        totalCashOuts: 60.0,
        averageCashOutAmount: 12.0,
        charityPercentage: 0.15
      }));

      // Create spy for revenue update events
      const revenueUpdateSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.REVENUE_UPDATE, revenueUpdateSpy);

      // Process multiple games
      for (let i = 1; i <= 5; i++) {
        const gameEvent: GameResolvedEvent = {
          type: "GAME_RESOLVED",
          timestamp: new Date(),
          gameId: `game-${i}`,
          winnerId: `player-${i}`,
          loserId: `player-${i + 5}`,
          winnerLevel: 2,
          loserLevel: 1,
          winnerDollarId: `dollar-${i}`,
          loserDollarId: `dollar-${i + 5}`,
          winnings: 3.6,
          gameResult: "WIN",
        };

        await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);
      }

      // Verify revenue update events were emitted with cumulative data
      expect(revenueUpdateSpy).toHaveBeenCalledTimes(5);
      
      // Check the final update has correct cumulative values
      const finalUpdate = revenueUpdateSpy.mock.calls[4][0];
      expect(finalUpdate).toMatchObject({
        type: "REVENUE_UPDATE",
        totalPlatformRevenue: 1.0, // 5 games × 0.2
        totalCharityContributions: 5.0,
        totalPlayerPayouts: 50.0,
        totalGames: 5,
        revenuePerGame: 0.2
      });

      subscription.unsubscribe();
    });

    it("should generate comprehensive revenue reports on request", async () => {
      // Process some events first
      const gameEvent: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "report-game",
        winnerId: "report-player",
        loserId: "report-opponent",
        winnerLevel: 3,
        loserLevel: 2,
        winnerDollarId: "report-dollar-1",
        loserDollarId: "report-dollar-2",
        winnings: 7.2,
        gameResult: "WIN",
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);

      // Get revenue report
      const report = handler.generateRevenueReport();

      expect(report).toMatchObject({
        summary: {
          platformClickRevenue: 2.4,
          charityContributions: 15.0,
          playerWinnings: 85.0,
          totalGames: 12
        },
        breakdown: {
          averageRevenuePerGame: 0.2,
          totalVolume: 102.4,
          platformMargin: 2.34,
          charityImpact: 15.0
        },
        validation: {
          isValid: true
        }
      });

      // Verify report was generated through revenue calculator
      expect(mockRevenueCalculator.generateRevenueReport).toHaveBeenCalled();
    });
  });

  describe("Financial Transaction Logging", () => {
    it("should log all financial transactions with detailed metadata", async () => {
      const gameEvent: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "logging-game",
        winnerId: "logging-winner",
        loserId: "logging-loser",
        winnerLevel: 4,
        loserLevel: 3,
        winnerDollarId: "logging-dollar-1",
        loserDollarId: "logging-dollar-2",
        winnings: 14.4,
        gameResult: "WIN",
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);

      // Get transaction history
      const transactions = handler.getTransactionHistory();

      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        type: "GAME_REVENUE",
        gameId: "logging-game",
        timestamp: expect.any(Date),
        amount: 0.2,
        details: {
          winnerId: "logging-winner",
          loserId: "logging-loser",
          winnings: 14.4,
          platformFee: 0.2
        }
      });
    });

    it("should log cash-out transactions with charity breakdown", async () => {
      const cashOutEvent: CashOutCompletedEvent = {
        type: "CASH_OUT_COMPLETED",
        timestamp: new Date(),
        playerId: "logging-cashout-player",
        virtualDollarId: "logging-cashout-dollar",
        finalLevel: 5,
        totalWinnings: 28.8,
        cashOutAmount: 20.0,
        runCompleted: true,
        wasJackpot: false,
      };

      await eventBus.emit(EVENT_TYPES.CASH_OUT_COMPLETED, cashOutEvent);

      const transactions = handler.getTransactionHistory();

      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        type: "CASH_OUT_REVENUE",
        playerId: "logging-cashout-player",
        virtualDollarId: "logging-cashout-dollar",
        timestamp: expect.any(Date),
        amount: 20.0,
        details: {
          playerAmount: 8.5,
          charityAmount: 1.5,
          finalLevel: 5,
          wasJackpot: false
        }
      });
    });

    it("should provide transaction filtering and search capabilities", async () => {
      // Process multiple different transaction types
      const gameEvent: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "filter-game",
        winnerId: "filter-winner",
        loserId: "filter-loser",
        winnerLevel: 2,
        loserLevel: 1,
        winnerDollarId: "filter-dollar-1",
        loserDollarId: "filter-dollar-2",
        winnings: 3.6,
        gameResult: "WIN",
      };

      const cashOutEvent: CashOutCompletedEvent = {
        type: "CASH_OUT_COMPLETED",
        timestamp: new Date(),
        playerId: "filter-cashout-player",
        virtualDollarId: "filter-cashout-dollar",
        finalLevel: 3,
        totalWinnings: 7.2,
        cashOutAmount: 5.0,
        runCompleted: true,
        wasJackpot: false,
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);
      await eventBus.emit(EVENT_TYPES.CASH_OUT_COMPLETED, cashOutEvent);

      // Filter by transaction type
      const gameTransactions = handler.getTransactionHistory({ type: "GAME_REVENUE" });
      const cashOutTransactions = handler.getTransactionHistory({ type: "CASH_OUT_REVENUE" });

      expect(gameTransactions).toHaveLength(1);
      expect(gameTransactions[0].type).toBe("GAME_REVENUE");

      expect(cashOutTransactions).toHaveLength(1);
      expect(cashOutTransactions[0].type).toBe("CASH_OUT_REVENUE");

      // Filter by player
      const playerTransactions = handler.getTransactionHistory({ 
        playerId: "filter-cashout-player" 
      });

      expect(playerTransactions).toHaveLength(1);
      expect(playerTransactions[0].playerId).toBe("filter-cashout-player");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle revenue calculation errors gracefully", async () => {
      // Mock revenue calculator to return error
      mockRevenueCalculator.processGameRevenue.mockReturnValue({
        isValid: false,
        errors: ["Game validation failed"],
        warnings: []
      });

      const gameEvent: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "error-game",
        winnerId: "error-winner",
        loserId: "error-loser",
        winnerLevel: 2,
        loserLevel: 1,
        winnerDollarId: "error-dollar-1",
        loserDollarId: "error-dollar-2",
        winnings: 3.6,
        gameResult: "WIN",
      };

      // Create spy for error events
      const errorSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.EVENT_ERROR, errorSpy);

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);

      // Verify error event was emitted
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EVENT_ERROR",
          eventType: "GAME_RESOLVED",
          error: expect.stringContaining("Game validation failed")
        })
      );

      subscription.unsubscribe();
    });

    it("should handle cash-out validation errors", async () => {
      // Mock cash-out to return validation error
      mockRevenueCalculator.processCashOut.mockReturnValue({
        playerAmount: 0,
        charityAmount: 0,
        validation: {
          isValid: false,
          errors: ["Cash-out amount is invalid"],
          warnings: []
        }
      });

      const cashOutEvent: CashOutCompletedEvent = {
        type: "CASH_OUT_COMPLETED",
        timestamp: new Date(),
        playerId: "invalid-cashout-player",
        virtualDollarId: "invalid-cashout-dollar",
        finalLevel: 2,
        totalWinnings: 3.6,
        cashOutAmount: -1.0, // Invalid negative amount
        runCompleted: true,
        wasJackpot: false,
      };

      const errorSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.EVENT_ERROR, errorSpy);

      await eventBus.emit(EVENT_TYPES.CASH_OUT_COMPLETED, cashOutEvent);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EVENT_ERROR",
          eventType: "CASH_OUT_COMPLETED",
          error: expect.stringContaining("Cash-out amount is invalid")
        })
      );

      subscription.unsubscribe();
    });

    it("should handle missing event data gracefully", async () => {
      const incompleteGameEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "incomplete-game",
        // Missing required fields
      } as GameResolvedEvent;

      const errorSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.EVENT_ERROR, errorSpy);

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, incompleteGameEvent);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EVENT_ERROR",
          eventType: "GAME_RESOLVED",
          error: expect.stringContaining("Missing required event data")
        })
      );

      subscription.unsubscribe();
    });

    it("should handle revenue calculator exceptions", async () => {
      // Mock revenue calculator to throw exception
      mockRevenueCalculator.processGameRevenue.mockImplementation(() => {
        throw new Error("Revenue calculator system failure");
      });

      const gameEvent: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date(),
        gameId: "exception-game",
        winnerId: "exception-winner",
        loserId: "exception-loser",
        winnerLevel: 3,
        loserLevel: 2,
        winnerDollarId: "exception-dollar-1",
        loserDollarId: "exception-dollar-2",
        winnings: 7.2,
        gameResult: "WIN",
      };

      const errorSpy = vi.fn();
      const subscription = eventBus.on(EVENT_TYPES.EVENT_ERROR, errorSpy);

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EVENT_ERROR",
          eventType: "GAME_RESOLVED",
          error: expect.stringContaining("Revenue calculator system failure")
        })
      );

      subscription.unsubscribe();
    });
  });

  describe("Integration with RevenueCalculator", () => {
    it("should properly format game sessions for revenue calculator", async () => {
      const gameEvent: GameResolvedEvent = {
        type: "GAME_RESOLVED",
        timestamp: new Date("2024-01-15T10:30:00Z"),
        gameId: "integration-game",
        winnerId: "integration-winner",
        loserId: "integration-loser",
        winnerLevel: 4,
        loserLevel: 3,
        winnerDollarId: "integration-dollar-1",
        loserDollarId: "integration-dollar-2",
        winnings: 14.4,
        gameResult: "WIN",
      };

      await eventBus.emit(EVENT_TYPES.GAME_RESOLVED, gameEvent);

      // Verify the game session was properly formatted
      expect(mockRevenueCalculator.processGameRevenue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "integration-game",
          timestamp: expect.any(Date),
          platformFee: 0.2, // Standard platform fee
          winnings: 14.4
        })
      );
    });

    it("should handle revenue calculator configuration changes", async () => {
      // Test charity percentage updates
      const charityPercentage = 0.20;
      handler.updateCharityPercentage(charityPercentage);

      // Should pass through to revenue calculator
      expect(mockRevenueCalculator.setCharityPercentage).toHaveBeenCalledWith(charityPercentage);
    });

    it("should validate revenue calculator integration on startup", async () => {
      // Create a new handler to test initialization
      const newHandler = new RevenueTrackingHandler(eventBus, mockRevenueCalculator);

      // Should validate revenue calculator is properly configured
      expect(mockRevenueCalculator.getRevenueStream).toHaveBeenCalled();

      newHandler.dispose();
    });
  });
});