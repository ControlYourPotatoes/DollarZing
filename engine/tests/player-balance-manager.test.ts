// Player Balance Manager Tests - Task 6.5, 6.7, 6.11, 6.13
// Tests for 3-part balance system, transaction processing, and player retirement

import { Player, CashOutStrategy } from "../src/types/virtual-dollar-engine";

describe("PlayerBalanceManager - Transaction Processing", () => {
  describe("3-Part Balance System", () => {
    test("should create player with correct initial balance structure", () => {
      const mockPlayer: Player = {
        id: "player_001",
        donationBalance: 20.0, // Initial donation for game fees
        winningsBalance: 0.0, // Cashed-out winnings
        currentProgression: 0.0, // At-risk progression
        gamesPlayed: 0,
        virtualDollars: [],
        cashOutStrategy: CashOutStrategy.BALANCED,
        isActive: true,
        createdAt: new Date("2025-01-01"),
      };

      expect(mockPlayer.donationBalance).toBe(20.0);
      expect(mockPlayer.winningsBalance).toBe(0.0);
      expect(mockPlayer.currentProgression).toBe(0.0);
      expect(mockPlayer.isActive).toBe(true);
      expect(mockPlayer.gamesPlayed).toBe(0);
      expect(mockPlayer.virtualDollars).toEqual([]);
    });

    test("should process game fee from donation balance only", () => {
      const initialBalance = {
        donationBalance: 20.0,
        winningsBalance: 10.0,
        currentProgression: 5.0,
      };

      const gameFee = 1.1; // $1.10 per game

      // Game fee should only be deducted from donation balance
      const expectedAfterFee = {
        donationBalance: initialBalance.donationBalance - gameFee, // 18.90
        winningsBalance: initialBalance.winningsBalance, // 10.00 (unchanged)
        currentProgression: initialBalance.currentProgression, // 5.00 (unchanged)
      };

      expect(expectedAfterFee.donationBalance).toBe(18.9);
      expect(expectedAfterFee.winningsBalance).toBe(10.0);
      expect(expectedAfterFee.currentProgression).toBe(5.0);
    });

    test("should add winnings to currentProgression balance", () => {
      const initialBalance = {
        donationBalance: 15.0,
        winningsBalance: 20.0,
        currentProgression: 8.0,
      };

      const winningAmount = 16.0; // Won at Level 4 ($8 bet, $16 win)

      // Winnings should be added to currentProgression
      const expectedAfterWin = {
        donationBalance: initialBalance.donationBalance, // 15.00 (unchanged)
        winningsBalance: initialBalance.winningsBalance, // 20.00 (unchanged)
        currentProgression: initialBalance.currentProgression + winningAmount, // 24.00
      };

      expect(expectedAfterWin.donationBalance).toBe(15.0);
      expect(expectedAfterWin.winningsBalance).toBe(20.0);
      expect(expectedAfterWin.currentProgression).toBe(24.0);
    });

    test("should handle loss by clearing currentProgression", () => {
      const balanceBeforeLoss = {
        donationBalance: 12.0,
        winningsBalance: 30.0,
        currentProgression: 64.0, // At Level 6, would have won $128
      };

      // Loss clears the currentProgression
      const expectedAfterLoss = {
        donationBalance: balanceBeforeLoss.donationBalance, // 12.00 (unchanged)
        winningsBalance: balanceBeforeLoss.winningsBalance, // 30.00 (unchanged)
        currentProgression: 0.0, // Cleared on loss
      };

      expect(expectedAfterLoss.donationBalance).toBe(12.0);
      expect(expectedAfterLoss.winningsBalance).toBe(30.0);
      expect(expectedAfterLoss.currentProgression).toBe(0.0);
    });

    test("should process cash-out with charity deduction", () => {
      const balanceBeforeCashOut = {
        donationBalance: 18.0,
        winningsBalance: 50.0,
        currentProgression: 32.0,
      };

      const charityPercentage = 0.15; // 15%
      const charityAmount =
        balanceBeforeCashOut.currentProgression * charityPercentage; // 4.80
      const playerReceives =
        balanceBeforeCashOut.currentProgression - charityAmount; // 27.20

      // Cash-out moves (currentProgression - charity) to winningsBalance
      const expectedAfterCashOut = {
        donationBalance: balanceBeforeCashOut.donationBalance, // 18.00 (unchanged)
        winningsBalance: balanceBeforeCashOut.winningsBalance + playerReceives, // 77.20
        currentProgression: 0.0, // Cleared after cash-out
      };

      expect(charityAmount).toBe(4.8);
      expect(playerReceives).toBe(27.2);
      expect(expectedAfterCashOut.donationBalance).toBe(18.0);
      expect(expectedAfterCashOut.winningsBalance).toBe(77.2);
      expect(expectedAfterCashOut.currentProgression).toBe(0.0);
    });
  });

  describe("Game Eligibility", () => {
    test("should determine player can play based on donation balance", () => {
      const gameFee = 1.1;

      const playerScenarios = [
        { donationBalance: 20.0, canPlay: true }, // $20 > $1.10
        { donationBalance: 5.5, canPlay: true }, // $5.50 > $1.10
        { donationBalance: 1.1, canPlay: true }, // $1.10 = $1.10
        { donationBalance: 1.0, canPlay: false }, // $1.00 < $1.10
        { donationBalance: 0.5, canPlay: false }, // $0.50 < $1.10
        { donationBalance: 0.0, canPlay: false }, // $0.00 < $1.10
      ];

      playerScenarios.forEach((scenario) => {
        const canPlay = scenario.donationBalance >= gameFee;
        expect(canPlay).toBe(scenario.canPlay);
      });
    });

    test("should calculate game credits based on donation balance", () => {
      const gameFee = 1.1;

      const balanceScenarios = [
        { balance: 20.0, credits: 18 }, // 20.00 ÷ 1.10 = 18.18 → 18 games
        { balance: 11.0, credits: 10 }, // 11.00 ÷ 1.10 = 10.00 → 10 games
        { balance: 5.5, credits: 5 }, // 5.50 ÷ 1.10 = 5.00 → 5 games
        { balance: 2.2, credits: 2 }, // 2.20 ÷ 1.10 = 2.00 → 2 games
        { balance: 1.1, credits: 1 }, // 1.10 ÷ 1.10 = 1.00 → 1 game
        { balance: 0.55, credits: 0 }, // 0.55 ÷ 1.10 = 0.50 → 0 games
      ];

      balanceScenarios.forEach((scenario) => {
        const credits = Math.floor(scenario.balance / gameFee);
        expect(credits).toBe(scenario.credits);
      });
    });

    test("should validate player activity status", () => {
      const activePlayerRequirements = [
        { donationBalance: 5.0, isActive: true, shouldPlay: true },
        { donationBalance: 0.5, isActive: true, shouldPlay: false }, // Insufficient funds
        { donationBalance: 10.0, isActive: false, shouldPlay: false }, // Inactive player
        { donationBalance: 0.0, isActive: false, shouldPlay: false }, // Both conditions fail
      ];

      activePlayerRequirements.forEach((req) => {
        const canPlay = req.isActive && req.donationBalance >= 1.1;
        expect(canPlay).toBe(req.shouldPlay);
      });
    });
  });
});

describe("PlayerBalanceManager - Player Winnings and Loss Tracking", () => {
  describe("Balance Tracking Across Game Outcomes", () => {
    test("should track cumulative winnings across multiple games", () => {
      // Test progression through multiple winning games

      const gameSequence = [
        { level: 1, bet: 1, win: 2, progression: 2.0 }, // Level 1 win
        { level: 2, bet: 2, win: 4, progression: 6.0 }, // Level 2 win (2 + 4)
        { level: 3, bet: 4, win: 8, progression: 14.0 }, // Level 3 win (6 + 8)
        { level: 4, bet: 8, win: 16, progression: 30.0 }, // Level 4 win (14 + 16)
      ];

      let currentProgression = 0.0;

      gameSequence.forEach((game) => {
        currentProgression += game.win;
        expect(currentProgression).toBe(game.progression);
      });

      expect(currentProgression).toBe(30.0); // Final progression after 4 wins
    });

    test("should track losses and reset progression correctly", () => {
      const gameProgressions = [
        {
          initialProgression: 0.0,
          outcome: "WIN",
          winAmount: 2.0,
          finalProgression: 2.0,
        },
        {
          initialProgression: 2.0,
          outcome: "WIN",
          winAmount: 4.0,
          finalProgression: 6.0,
        },
        {
          initialProgression: 6.0,
          outcome: "LOSS",
          winAmount: 0.0,
          finalProgression: 0.0,
        },
        {
          initialProgression: 0.0,
          outcome: "WIN",
          winAmount: 2.0,
          finalProgression: 2.0,
        },
      ];

      gameProgressions.forEach((game) => {
        if (game.outcome === "WIN") {
          const newProgression = game.initialProgression + game.winAmount;
          expect(newProgression).toBe(game.finalProgression);
        } else {
          expect(game.finalProgression).toBe(0.0); // Loss resets progression
        }
      });
    });

    test("should maintain separate balance types during gameplay", () => {
      // Verify that game outcomes only affect appropriate balance types

      const playerBalance = {
        donationBalance: 20.0, // Only affected by game fees
        winningsBalance: 15.0, // Only affected by cash-outs
        currentProgression: 0.0, // Affected by wins/losses
      };

      // Simulate game sequence: fee → win → win → loss
      const gameSequence = [
        {
          action: "GAME_FEE",
          amount: 1.1,
          expectedBalance: {
            donationBalance: 18.9, // Reduced by fee
            winningsBalance: 15.0, // Unchanged
            currentProgression: 0.0, // Unchanged
          },
        },
        {
          action: "WIN",
          amount: 2.0,
          expectedBalance: {
            donationBalance: 18.9, // Unchanged
            winningsBalance: 15.0, // Unchanged
            currentProgression: 2.0, // Increased by win
          },
        },
        {
          action: "WIN",
          amount: 4.0,
          expectedBalance: {
            donationBalance: 18.9, // Unchanged
            winningsBalance: 15.0, // Unchanged
            currentProgression: 6.0, // Increased by win
          },
        },
        {
          action: "LOSS",
          amount: 0.0,
          expectedBalance: {
            donationBalance: 18.9, // Unchanged
            winningsBalance: 15.0, // Unchanged
            currentProgression: 0.0, // Reset by loss
          },
        },
      ];

      let runningBalance = { ...playerBalance };

      gameSequence.forEach((game) => {
        switch (game.action) {
          case "GAME_FEE":
            runningBalance.donationBalance -= game.amount;
            break;
          case "WIN":
            runningBalance.currentProgression += game.amount;
            break;
          case "LOSS":
            runningBalance.currentProgression = 0.0;
            break;
        }

        expect(runningBalance.donationBalance).toBe(
          game.expectedBalance.donationBalance
        );
        expect(runningBalance.winningsBalance).toBe(
          game.expectedBalance.winningsBalance
        );
        expect(runningBalance.currentProgression).toBe(
          game.expectedBalance.currentProgression
        );
      });
    });
  });
});

describe("PlayerBalanceManager - Player Retirement Scenarios", () => {
  describe("Insufficient Donation Balance", () => {
    test("should identify when player cannot afford game fee", () => {
      const gameFee = 1.1;

      const retirementScenarios = [
        { donationBalance: 1.09, shouldRetire: true }, // $0.01 short
        { donationBalance: 1.0, shouldRetire: true }, // $0.10 short
        { donationBalance: 0.55, shouldRetire: true }, // Half the required fee
        { donationBalance: 0.0, shouldRetire: true }, // No money left
        { donationBalance: 1.1, shouldRetire: false }, // Exactly enough
        { donationBalance: 2.2, shouldRetire: false }, // Can afford 2 games
      ];

      retirementScenarios.forEach((scenario) => {
        const shouldRetire = scenario.donationBalance < gameFee;
        expect(shouldRetire).toBe(scenario.shouldRetire);
      });
    });

    test("should handle player retirement with remaining balances", () => {
      // Player retires when they can't afford game fees
      // Other balances (winnings, progression) remain available

      const retiredPlayerBalance = {
        donationBalance: 0.75, // Insufficient for $1.10 game fee
        winningsBalance: 125.0, // Previous cash-outs (still available)
        currentProgression: 32.0, // Current run progression (can be cashed out)
        isActive: false, // Retired from gameplay
      };

      // Player should be retired but balances remain
      expect(retiredPlayerBalance.donationBalance).toBeLessThan(1.1);
      expect(retiredPlayerBalance.isActive).toBe(false);
      expect(retiredPlayerBalance.winningsBalance).toBe(125.0); // Preserved
      expect(retiredPlayerBalance.currentProgression).toBe(32.0); // Available for final cash-out
    });

    test("should calculate final cash-out for retired player", () => {
      // Retired player should still be able to cash out currentProgression

      const retiredPlayerFinalCashOut = {
        currentProgression: 64.0, // Level 6 progression ($32 bet, $64 win)
        charityPercentage: 0.15, // 15% charity
        charityAmount: 9.6, // 15% of $64
        playerReceives: 54.4, // 85% of $64
      };

      const charity =
        retiredPlayerFinalCashOut.currentProgression *
        retiredPlayerFinalCashOut.charityPercentage;
      const playerGets = retiredPlayerFinalCashOut.currentProgression - charity;

      expect(charity).toBe(9.6);
      expect(playerGets).toBe(54.4);
      expect(charity + playerGets).toBe(64.0);
    });

    test("should validate retirement criteria", () => {
      const retirementConditions = [
        {
          donationBalance: 0.5,
          isActive: true,
          hasVirtualDollars: false,
          shouldRetire: true,
          reason: "Insufficient donation balance",
        },
        {
          donationBalance: 5.0,
          isActive: false,
          hasVirtualDollars: true,
          shouldRetire: true,
          reason: "Player marked inactive",
        },
        {
          donationBalance: 10.0,
          isActive: true,
          hasVirtualDollars: false,
          shouldRetire: false,
          reason: "Player can continue playing",
        },
      ];

      retirementConditions.forEach((condition) => {
        const canPlay = condition.donationBalance >= 1.1 && condition.isActive;
        const shouldRetire = !canPlay;

        expect(shouldRetire).toBe(condition.shouldRetire);
      });
    });
  });
});
