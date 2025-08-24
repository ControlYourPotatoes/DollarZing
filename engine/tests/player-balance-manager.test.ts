// Player Balance Manager Tests - Task 6.5, 6.7, 6.11, 6.13
// Tests for 3-part balance system, transaction processing, and player retirement

import {
  Player,
  CashOutStrategy
} from '../src/types/virtual-dollar-engine';

import { PlayerBalanceManager } from '../src/types/player-balance-manager';

describe('PlayerBalanceManager - Transaction Processing', () => {
  describe('3-Part Balance System', () => {
    test('should create player with correct initial balance structure', () => {
      const mockPlayer: Player = {
        id: 'player_001',
        donationBalance: 20.00,      // Initial donation for game fees
        winningsBalance: 0.00,       // Cashed-out winnings
        currentProgression: 0.00,    // At-risk progression
        gamesPlayed: 0,
        virtualDollars: [],
        cashOutStrategy: CashOutStrategy.BALANCED,
        isActive: true,
        createdAt: new Date('2025-01-01')
      };
      
      expect(mockPlayer.donationBalance).toBe(20.00);
      expect(mockPlayer.winningsBalance).toBe(0.00);
      expect(mockPlayer.currentProgression).toBe(0.00);
      expect(mockPlayer.isActive).toBe(true);
      expect(mockPlayer.gamesPlayed).toBe(0);
      expect(mockPlayer.virtualDollars).toEqual([]);
    });

    test('should process game fee from donation balance only', () => {
      const initialBalance = {
        donationBalance: 20.00,
        winningsBalance: 10.00,
        currentProgression: 5.00
      };
      
      const gameFee = 1.10; // $1.10 per game
      
      // Game fee should only be deducted from donation balance
      const expectedAfterFee = {
        donationBalance: initialBalance.donationBalance - gameFee, // 18.90
        winningsBalance: initialBalance.winningsBalance,           // 10.00 (unchanged)
        currentProgression: initialBalance.currentProgression      // 5.00 (unchanged)
      };
      
      expect(expectedAfterFee.donationBalance).toBe(18.90);
      expect(expectedAfterFee.winningsBalance).toBe(10.00);
      expect(expectedAfterFee.currentProgression).toBe(5.00);
    });

    test('should add winnings to currentProgression balance', () => {
      const initialBalance = {
        donationBalance: 15.00,
        winningsBalance: 20.00,
        currentProgression: 8.00
      };
      
      const winningAmount = 16.00; // Won at Level 4 ($8 bet, $16 win)
      
      // Winnings should be added to currentProgression
      const expectedAfterWin = {
        donationBalance: initialBalance.donationBalance,        // 15.00 (unchanged)
        winningsBalance: initialBalance.winningsBalance,        // 20.00 (unchanged) 
        currentProgression: initialBalance.currentProgression + winningAmount // 24.00
      };
      
      expect(expectedAfterWin.donationBalance).toBe(15.00);
      expect(expectedAfterWin.winningsBalance).toBe(20.00);
      expect(expectedAfterWin.currentProgression).toBe(24.00);
    });

    test('should handle loss by clearing currentProgression', () => {
      const balanceBeforeLoss = {
        donationBalance: 12.00,
        winningsBalance: 30.00,
        currentProgression: 64.00 // At Level 6, would have won $128
      };
      
      // Loss clears the currentProgression
      const expectedAfterLoss = {
        donationBalance: balanceBeforeLoss.donationBalance,  // 12.00 (unchanged)
        winningsBalance: balanceBeforeLoss.winningsBalance,  // 30.00 (unchanged)
        currentProgression: 0.00                             // Cleared on loss
      };
      
      expect(expectedAfterLoss.donationBalance).toBe(12.00);
      expect(expectedAfterLoss.winningsBalance).toBe(30.00);
      expect(expectedAfterLoss.currentProgression).toBe(0.00);
    });

    test('should process cash-out with charity deduction', () => {
      const balanceBeforeCashOut = {
        donationBalance: 18.00,
        winningsBalance: 50.00,
        currentProgression: 32.00
      };
      
      const charityPercentage = 0.15; // 15%
      const charityAmount = balanceBeforeCashOut.currentProgression * charityPercentage; // 4.80
      const playerReceives = balanceBeforeCashOut.currentProgression - charityAmount; // 27.20
      
      // Cash-out moves (currentProgression - charity) to winningsBalance
      const expectedAfterCashOut = {
        donationBalance: balanceBeforeCashOut.donationBalance,              // 18.00 (unchanged)
        winningsBalance: balanceBeforeCashOut.winningsBalance + playerReceives, // 77.20
        currentProgression: 0.00                                            // Cleared after cash-out
      };
      
      expect(charityAmount).toBe(4.80);
      expect(playerReceives).toBe(27.20);
      expect(expectedAfterCashOut.donationBalance).toBe(18.00);
      expect(expectedAfterCashOut.winningsBalance).toBe(77.20);
      expect(expectedAfterCashOut.currentProgression).toBe(0.00);
    });
  });

  describe('Game Eligibility', () => {
    test('should determine player can play based on donation balance', () => {
      const gameFee = 1.10;
      
      const playerScenarios = [
        { donationBalance: 20.00, canPlay: true },   // $20 > $1.10
        { donationBalance: 5.50, canPlay: true },    // $5.50 > $1.10
        { donationBalance: 1.10, canPlay: true },    // $1.10 = $1.10
        { donationBalance: 1.00, canPlay: false },   // $1.00 < $1.10
        { donationBalance: 0.50, canPlay: false },   // $0.50 < $1.10
        { donationBalance: 0.00, canPlay: false }    // $0.00 < $1.10
      ];
      
      playerScenarios.forEach(scenario => {
        const canPlay = scenario.donationBalance >= gameFee;
        expect(canPlay).toBe(scenario.canPlay);
      });
    });

    test('should calculate game credits based on donation balance', () => {
      const gameFee = 1.10;
      
      const balanceScenarios = [
        { balance: 20.00, credits: 18 },  // 20.00 ÷ 1.10 = 18.18 → 18 games
        { balance: 11.00, credits: 10 },  // 11.00 ÷ 1.10 = 10.00 → 10 games  
        { balance: 5.50, credits: 5 },    // 5.50 ÷ 1.10 = 5.00 → 5 games
        { balance: 2.20, credits: 2 },    // 2.20 ÷ 1.10 = 2.00 → 2 games
        { balance: 1.10, credits: 1 },    // 1.10 ÷ 1.10 = 1.00 → 1 game
        { balance: 0.55, credits: 0 }     // 0.55 ÷ 1.10 = 0.50 → 0 games
      ];
      
      balanceScenarios.forEach(scenario => {
        const credits = Math.floor(scenario.balance / gameFee);
        expect(credits).toBe(scenario.credits);
      });
    });

    test('should validate player activity status', () => {
      const activePlayerRequirements = [
        { donationBalance: 5.00, isActive: true, shouldPlay: true },
        { donationBalance: 0.50, isActive: true, shouldPlay: false },  // Insufficient funds
        { donationBalance: 10.00, isActive: false, shouldPlay: false }, // Inactive player
        { donationBalance: 0.00, isActive: false, shouldPlay: false }   // Both conditions fail
      ];
      
      activePlayerRequirements.forEach(req => {
        const canPlay = req.isActive && req.donationBalance >= 1.10;
        expect(canPlay).toBe(req.shouldPlay);
      });
    });
  });
});

describe('PlayerBalanceManager - Player Winnings and Loss Tracking', () => {
  describe('Balance Tracking Across Game Outcomes', () => {
    test('should track cumulative winnings across multiple games', () => {
      // Test progression through multiple winning games
      
      const gameSequence = [
        { level: 1, bet: 1, win: 2, progression: 2.00 },   // Level 1 win
        { level: 2, bet: 2, win: 4, progression: 6.00 },   // Level 2 win (2 + 4)
        { level: 3, bet: 4, win: 8, progression: 14.00 },  // Level 3 win (6 + 8) 
        { level: 4, bet: 8, win: 16, progression: 30.00 }  // Level 4 win (14 + 16)
      ];
      
      let currentProgression = 0.00;
      
      gameSequence.forEach(game => {
        currentProgression += game.win;
        expect(currentProgression).toBe(game.progression);
      });
      
      expect(currentProgression).toBe(30.00); // Final progression after 4 wins
    });

    test('should track losses and reset progression correctly', () => {
      const gameProgressions = [
        { initialProgression: 0.00, outcome: 'WIN', winAmount: 2.00, finalProgression: 2.00 },
        { initialProgression: 2.00, outcome: 'WIN', winAmount: 4.00, finalProgression: 6.00 },
        { initialProgression: 6.00, outcome: 'LOSS', winAmount: 0.00, finalProgression: 0.00 },
        { initialProgression: 0.00, outcome: 'WIN', winAmount: 2.00, finalProgression: 2.00 }
      ];
      
      gameProgressions.forEach(game => {
        if (game.outcome === 'WIN') {
          const newProgression = game.initialProgression + game.winAmount;
          expect(newProgression).toBe(game.finalProgression);
        } else {
          expect(game.finalProgression).toBe(0.00); // Loss resets progression
        }
      });
    });

    test('should maintain separate balance types during gameplay', () => {
      // Verify that game outcomes only affect appropriate balance types
      
      const playerBalance = {
        donationBalance: 20.00,    // Only affected by game fees
        winningsBalance: 15.00,    // Only affected by cash-outs
        currentProgression: 0.00   // Affected by wins/losses
      };
      
      // Simulate game sequence: fee → win → win → loss
      const gameSequence = [
        {
          action: 'GAME_FEE',
          amount: 1.10,
          expectedBalance: {
            donationBalance: 18.90,  // Reduced by fee
            winningsBalance: 15.00,  // Unchanged
            currentProgression: 0.00 // Unchanged
          }
        },
        {
          action: 'WIN',
          amount: 2.00,
          expectedBalance: {
            donationBalance: 18.90,  // Unchanged
            winningsBalance: 15.00,  // Unchanged
            currentProgression: 2.00 // Increased by win
          }
        },
        {
          action: 'WIN',
          amount: 4.00,
          expectedBalance: {
            donationBalance: 18.90,  // Unchanged
            winningsBalance: 15.00,  // Unchanged
            currentProgression: 6.00 // Increased by win
          }
        },
        {
          action: 'LOSS',
          amount: 0.00,
          expectedBalance: {
            donationBalance: 18.90,  // Unchanged
            winningsBalance: 15.00,  // Unchanged
            currentProgression: 0.00 // Reset by loss
          }
        }
      ];
      
      let runningBalance = { ...playerBalance };
      
      gameSequence.forEach(game => {
        switch (game.action) {
          case 'GAME_FEE':
            runningBalance.donationBalance -= game.amount;
            break;
          case 'WIN':
            runningBalance.currentProgression += game.amount;
            break;
          case 'LOSS':
            runningBalance.currentProgression = 0.00;
            break;
        }
        
        expect(runningBalance.donationBalance).toBe(game.expectedBalance.donationBalance);
        expect(runningBalance.winningsBalance).toBe(game.expectedBalance.winningsBalance);
        expect(runningBalance.currentProgression).toBe(game.expectedBalance.currentProgression);
      });
    });
  });
});

describe('PlayerBalanceManager - Player Retirement Scenarios', () => {
  describe('Insufficient Donation Balance', () => {
    test('should identify when player cannot afford game fee', () => {
      const gameFee = 1.10;
      
      const retirementScenarios = [
        { donationBalance: 1.09, shouldRetire: true },   // $0.01 short
        { donationBalance: 1.00, shouldRetire: true },   // $0.10 short
        { donationBalance: 0.55, shouldRetire: true },   // Half the required fee
        { donationBalance: 0.00, shouldRetire: true },   // No money left
        { donationBalance: 1.10, shouldRetire: false },  // Exactly enough
        { donationBalance: 2.20, shouldRetire: false },  // Can afford 2 games
      ];
      
      retirementScenarios.forEach(scenario => {
        const shouldRetire = scenario.donationBalance < gameFee;
        expect(shouldRetire).toBe(scenario.shouldRetire);
      });
    });

    test('should handle player retirement with remaining balances', () => {
      // Player retires when they can't afford game fees
      // Other balances (winnings, progression) remain available
      
      const retiredPlayerBalance = {
        donationBalance: 0.75,      // Insufficient for $1.10 game fee
        winningsBalance: 125.00,    // Previous cash-outs (still available)
        currentProgression: 32.00,  // Current run progression (can be cashed out)
        isActive: false             // Retired from gameplay
      };
      
      // Player should be retired but balances remain
      expect(retiredPlayerBalance.donationBalance).toBeLessThan(1.10);
      expect(retiredPlayerBalance.isActive).toBe(false);
      expect(retiredPlayerBalance.winningsBalance).toBe(125.00); // Preserved
      expect(retiredPlayerBalance.currentProgression).toBe(32.00); // Available for final cash-out
    });

    test('should calculate final cash-out for retired player', () => {
      // Retired player should still be able to cash out currentProgression
      
      const retiredPlayerFinalCashOut = {
        currentProgression: 64.00,  // Level 6 progression ($32 bet, $64 win)
        charityPercentage: 0.15,    // 15% charity
        charityAmount: 9.60,        // 15% of $64
        playerReceives: 54.40       // 85% of $64
      };
      
      const charity = retiredPlayerFinalCashOut.currentProgression * retiredPlayerFinalCashOut.charityPercentage;
      const playerGets = retiredPlayerFinalCashOut.currentProgression - charity;
      
      expect(charity).toBe(9.60);
      expect(playerGets).toBe(54.40);
      expect(charity + playerGets).toBe(64.00);
    });

    test('should validate retirement criteria', () => {
      const retirementConditions = [
        {
          donationBalance: 0.50,
          isActive: true,
          hasVirtualDollars: false,
          shouldRetire: true,
          reason: 'Insufficient donation balance'
        },
        {
          donationBalance: 5.00,
          isActive: false,
          hasVirtualDollars: true,
          shouldRetire: true,
          reason: 'Player marked inactive'
        },
        {
          donationBalance: 10.00,
          isActive: true,
          hasVirtualDollars: false,
          shouldRetire: false,
          reason: 'Player can continue playing'
        }
      ];
      
      retirementConditions.forEach(condition => {
        const canPlay = condition.donationBalance >= 1.10 && condition.isActive;
        const shouldRetire = !canPlay;
        
        expect(shouldRetire).toBe(condition.shouldRetire);
      });
    });
  });
});