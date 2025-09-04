// Revenue Calculator Integration Tests - Task 6.2, 6.4, 6.10, 6.12
// Integration tests for RevenueCalculator with real implementation

import { GameSession, DollarState } from "../src/types/virtual-dollar-engine";
import { RevenueCalculator } from "../src/types/revenue-calculator";
import { VirtualDollarManager } from "../src/types/virtual-dollar-types";

describe("RevenueCalculator - Integration Tests", () => {
  let revenueCalculator: RevenueCalculator;
  let dollarManager: VirtualDollarManager;

  beforeEach(() => {
    revenueCalculator = new RevenueCalculator(0.15); // 15% charity
    dollarManager = new VirtualDollarManager();
  });

  describe("Real Implementation Tests", () => {
    // Helper function to create real GameSession objects
    const createGameSession = (
      id: string,
      level: number,
      winner: any,
      loser: any,
      winnings: number,
      dollar1Score: number,
      dollar2Score: number
    ): GameSession => {
      return {
        id,
        dollar1: winner,
        dollar2: loser,
        winner,
        loser,
        level: level as any,
        platformFee: 0.2,
        timestamp: new Date(),
        gameNumber: 1,
        dailySeed: "seed123",
        dollar1Score,
        dollar2Score,
        winnings,
        isCompleted: true,
        duration: 1500,
        randomSeed: 0.5,
      };
    };
    test("should process game revenue correctly", () => {
      // Create real VirtualDollar objects using VirtualDollarManager
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      // Update their states to POOLED for the game
      dollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      const gameSession = createGameSession(
        "game_123",
        1,
        dollar1,
        dollar2,
        2.0,
        0.75,
        0.68
      );

      const result = revenueCalculator.processGameRevenue(gameSession);

      expect(result.isValid).toBe(true);
      expect(revenueCalculator.getPlatformRevenue()).toBe(0.2);
      expect(revenueCalculator.getTotalGames()).toBe(1);

      const revenueStream = revenueCalculator.getRevenueStream();
      expect(revenueStream.platformClickRevenue).toBe(0.2);
      expect(revenueStream.totalClickFees).toBe(0.2);
      expect(revenueStream.totalGames).toBe(1);
    });

    test("should process cash-out with charity correctly", () => {
      const result = revenueCalculator.processCashOut(100.0);

      expect(result.validation.isValid).toBe(true);
      expect(result.charityAmount).toBe(15.0); // 15% of $100
      expect(result.playerAmount).toBe(85.0); // 85% of $100
      expect(revenueCalculator.getCharityContributions()).toBe(15.0);
      expect(revenueCalculator.getPlayerWinnings()).toBe(85.0);
    });

    test("should validate charity percentage bounds", () => {
      const lowResult = revenueCalculator.setCharityPercentage(0.05); // 5% - invalid
      expect(lowResult.isValid).toBe(false);
      expect(lowResult.errors).toContain(
        "Charity percentage must be between 0.10 (10%) and 1.00 (100%)"
      );

      const highResult = revenueCalculator.setCharityPercentage(1.01); // 101% - invalid
      expect(highResult.isValid).toBe(false);
      expect(highResult.errors).toContain(
        "Charity percentage must be between 0.10 (10%) and 1.00 (100%)"
      );

      const validResult = revenueCalculator.setCharityPercentage(0.25); // 25% - valid
      expect(validResult.isValid).toBe(true);
      expect(revenueCalculator.getCharityPercentage()).toBe(0.25);
    });

    test("should generate comprehensive revenue report", () => {
      // Create real VirtualDollar objects
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      // Update their states to POOLED
      dollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      // Process some games and cash-outs
      const game1 = createGameSession(
        "game1",
        1,
        dollar1,
        dollar2,
        2.0,
        0.8,
        0.6
      );
      const game2 = createGameSession(
        "game2",
        2,
        dollar2,
        dollar1,
        4.0,
        0.7,
        0.9
      );

      revenueCalculator.processGameRevenue(game1);
      revenueCalculator.processGameRevenue(game2);
      revenueCalculator.processCashOut(50.0);
      revenueCalculator.processCashOut(30.0);

      const report = revenueCalculator.generateRevenueReport();

      expect(report.validation.isValid).toBe(true);
      expect(report.summary.totalGames).toBe(2);
      expect(report.summary.platformClickRevenue).toBe(0.4); // 2 games × 20c
      expect(report.summary.charityContributions).toBe(12.0); // 15% of $80 total cash-outs
      expect(report.summary.playerWinnings).toBe(68.0); // 85% of $80 total cash-outs
      expect(report.breakdown.averageRevenuePerGame).toBe(0.2); // 40c ÷ 2 games
    });

    test("should handle validation of zero values and maximum amounts", () => {
      // Test zero amount validation
      const zeroResult = revenueCalculator.validateAmount(0, false);
      expect(zeroResult.isValid).toBe(false);
      expect(zeroResult.errors).toContain("Amount cannot be zero");

      const zeroAllowedResult = revenueCalculator.validateAmount(0, true);
      expect(zeroAllowedResult.isValid).toBe(true);

      // Test negative amount validation
      const negativeResult = revenueCalculator.validateAmount(-10);
      expect(negativeResult.isValid).toBe(false);
      expect(negativeResult.errors).toContain("Amount cannot be negative");

      // Test maximum amount warning
      const highAmountResult = revenueCalculator.validateAmount(15000);
      expect(highAmountResult.isValid).toBe(true);
      expect(highAmountResult.warnings).toContain("Amount is unusually high");
    });

    test("should process multiple cash-outs with different charity percentages", () => {
      // Test with different charity rates
      const scenarios = [
        {
          percentage: 0.1,
          amount: 100.0,
          expectedCharity: 10.0,
          expectedPlayer: 90.0,
        },
        {
          percentage: 0.25,
          amount: 200.0,
          expectedCharity: 50.0,
          expectedPlayer: 150.0,
        },
        {
          percentage: 0.5,
          amount: 80.0,
          expectedCharity: 40.0,
          expectedPlayer: 40.0,
        },
      ];

      scenarios.forEach((scenario) => {
        revenueCalculator.reset(scenario.percentage);
        const result = revenueCalculator.processCashOut(scenario.amount);

        expect(result.validation.isValid).toBe(true);
        expect(result.charityAmount).toBe(scenario.expectedCharity);
        expect(result.playerAmount).toBe(scenario.expectedPlayer);
      });
    });

    test("should maintain accurate game history", () => {
      // Create real VirtualDollar objects
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      // Update their states to POOLED
      dollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      const games: GameSession[] = [
        createGameSession("game1", 1, dollar1, dollar2, 2.0, 0.8, 0.6),
        createGameSession("game2", 3, dollar2, dollar1, 8.0, 0.7, 0.9),
      ];

      games.forEach((game) => {
        revenueCalculator.processGameRevenue(game);
      });

      const history = revenueCalculator.getGameHistory();
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe("game1");
      expect(history[1].id).toBe("game2");
      expect(history[0].level).toBe(1);
      expect(history[1].level).toBe(3);
    });

    test("should handle platform fee configuration correctly", () => {
      const config = revenueCalculator.getPlatformFeeConfiguration();

      expect(config.perPlayer).toBe(0.1); // 10 cents per player
      expect(config.perGame).toBe(0.2); // 20 cents per game
      expect(config.totalPlayers).toBe(2); // 2 players per game
    });

    test("should reset revenue calculator correctly", () => {
      // Create real VirtualDollar objects
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      // Update their states to POOLED
      dollarManager.updateDollarState(dollar1.id, DollarState.POOLED);
      dollarManager.updateDollarState(dollar2.id, DollarState.POOLED);

      // Add some data first
      const game = createGameSession(
        "testGame",
        1,
        dollar1,
        dollar2,
        2.0,
        0.8,
        0.6
      );

      revenueCalculator.processGameRevenue(game);
      revenueCalculator.processCashOut(50.0);

      // Verify data exists
      expect(revenueCalculator.getTotalGames()).toBe(1);
      expect(revenueCalculator.getCharityContributions()).toBe(7.5);

      // Reset
      const resetResult = revenueCalculator.reset(0.2); // 20% charity
      expect(resetResult.isValid).toBe(true);

      // Verify reset worked
      expect(revenueCalculator.getTotalGames()).toBe(0);
      expect(revenueCalculator.getCharityContributions()).toBe(0);
      expect(revenueCalculator.getPlatformRevenue()).toBe(0);
      expect(revenueCalculator.getCharityPercentage()).toBe(0.2);
      expect(revenueCalculator.getGameHistory()).toHaveLength(0);
    });

    test("should handle edge cases gracefully", () => {
      // Test cash-out with zero progression
      const zeroResult = revenueCalculator.processCashOut(0);
      expect(zeroResult.validation.isValid).toBe(true);
      expect(zeroResult.playerAmount).toBe(0);
      expect(zeroResult.charityAmount).toBe(0);
      expect(zeroResult.validation.warnings).toContain(
        "Cash-out amount is zero"
      );

      // Test invalid game session
      const dollar1 = dollarManager.createVirtualDollar("player1");
      const dollar2 = dollarManager.createVirtualDollar("player2");

      const invalidGame = {
        id: "", // Invalid empty ID
        dollar1: dollar1,
        dollar2: dollar2,
        winner: dollar1,
        loser: dollar2,
        level: 1 as const,
        platformFee: 0.2,
        timestamp: new Date(Date.now() + 10000), // Future timestamp
        gameNumber: 1,
        dailySeed: "seed",
        dollar1Score: 0.8,
        dollar2Score: 0.6,
        winnings: -5.0, // Negative winnings
        isCompleted: true,
        duration: 1000,
        randomSeed: 0.5,
      };

      const invalidResult = revenueCalculator.processGameRevenue(invalidGame);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
});
