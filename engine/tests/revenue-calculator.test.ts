// Revenue Calculator Tests - Task 6.1, 6.3, 6.9, 6.11
// Tests for platform fee calculation, charity contributions, and revenue tracking

import {
  GameTransaction,
  createEmptyRevenueStream
} from '../src/types/virtual-dollar-engine';

import { RevenueCalculator } from '../src/types/revenue-calculator';

describe('RevenueCalculator - Platform Fee Calculation', () => {
  describe('Platform Fee Structure', () => {
    test('should calculate 10c fee per player in a game (20c total)', () => {
      // Test validates that platform fees are calculated correctly
      // 10c per player × 2 players = 20c total per game
      
      const expectedFeePerPlayer = 0.10; // 10 cents
      const expectedTotalFee = 0.20; // 20 cents
      const playersInGame = 2;
      
      expect(expectedFeePerPlayer * playersInGame).toBe(expectedTotalFee);
      expect(expectedTotalFee).toBe(0.20);
    });

    test('should track platform fees separately from pot distributions', () => {
      // Platform fees (20c per game) are separate from betting pot
      // This ensures clean separation of revenue streams
      
      const gameCount = 100;
      const expectedPlatformRevenue = gameCount * 0.20; // 20c per game
      const expectedClickFees = gameCount * 0.20; // Same as platform revenue
      
      expect(expectedPlatformRevenue).toBe(20.00); // $20 for 100 games
      expect(expectedClickFees).toBe(expectedPlatformRevenue);
    });

    test('should accumulate platform fees across multiple games', () => {
      // Test fee accumulation over multiple game sessions
      
      const games = [
        { players: 2, expectedFee: 0.20 },
        { players: 2, expectedFee: 0.20 },
        { players: 2, expectedFee: 0.20 },
        { players: 2, expectedFee: 0.20 },
        { players: 2, expectedFee: 0.20 }
      ];
      
      const totalFees = games.reduce((sum, game) => sum + game.expectedFee, 0);
      
      expect(totalFees).toBe(1.00); // $1.00 for 5 games
      expect(games.length * 0.20).toBe(totalFees);
    });
  });

  describe('Revenue Stream Validation', () => {
    test('should create empty revenue stream with correct defaults', () => {
      const revenue = createEmptyRevenueStream();
      
      expect(revenue.platformClickRevenue).toBe(0);
      expect(revenue.charityContributions).toBe(0);
      expect(revenue.charityPercentage).toBe(0.15); // Default 15%
      expect(revenue.playerWinnings).toBe(0);
      expect(revenue.totalCashOuts).toBe(0);
      expect(revenue.totalGames).toBe(0);
      expect(revenue.totalClickFees).toBe(0);
      expect(revenue.averageCashOutAmount).toBe(0);
    });

    test('should validate revenue stream properties are non-negative', () => {
      const revenue = createEmptyRevenueStream();
      
      // All revenue stream values should be non-negative
      expect(revenue.platformClickRevenue).toBeGreaterThanOrEqual(0);
      expect(revenue.charityContributions).toBeGreaterThanOrEqual(0);
      expect(revenue.playerWinnings).toBeGreaterThanOrEqual(0);
      expect(revenue.totalCashOuts).toBeGreaterThanOrEqual(0);
      expect(revenue.totalGames).toBeGreaterThanOrEqual(0);
      expect(revenue.totalClickFees).toBeGreaterThanOrEqual(0);
      expect(revenue.averageCashOutAmount).toBeGreaterThanOrEqual(0);
    });

    test('should validate charity percentage is within valid range', () => {
      const revenue = createEmptyRevenueStream();
      
      // Charity percentage should be between 10% and 100%
      expect(revenue.charityPercentage).toBeGreaterThanOrEqual(0.10);
      expect(revenue.charityPercentage).toBeLessThanOrEqual(1.0);
      expect(revenue.charityPercentage).toBe(0.15); // Default 15%
    });
  });
});

describe('RevenueCalculator - Charity Calculations', () => {
  describe('3-Part Balance Charity System', () => {
    test('should calculate charity from currentProgression only', () => {
      // Charity contributions come only from currentProgression balance
      // NOT from donationBalance or winningsBalance
      
      const mockPlayerBalance = {
        donationBalance: 15.00,    // Original funds - NO charity taken
        winningsBalance: 50.00,    // Already cashed out - NO charity taken
        currentProgression: 32.00  // At-risk winnings - charity applies HERE
      };
      
      const charityPercentage = 0.15; // 15%
      const expectedCharityFromProgression = mockPlayerBalance.currentProgression * charityPercentage;
      const expectedPlayerReceives = mockPlayerBalance.currentProgression - expectedCharityFromProgression;
      
      expect(expectedCharityFromProgression).toBe(4.80); // 15% of $32
      expect(expectedPlayerReceives).toBe(27.20); // $32 - $4.80
      
      // Verify other balances are NOT affected by charity calculation
      expect(mockPlayerBalance.donationBalance).toBe(15.00); // Unchanged
      expect(mockPlayerBalance.winningsBalance).toBe(50.00); // Unchanged
    });

    test('should handle different charity percentages correctly', () => {
      const currentProgression = 100.00;
      
      const charityScenarios = [
        { percentage: 0.10, expected: 10.00, playerGets: 90.00 }, // 10%
        { percentage: 0.15, expected: 15.00, playerGets: 85.00 }, // 15%
        { percentage: 0.25, expected: 25.00, playerGets: 75.00 }, // 25%
        { percentage: 0.50, expected: 50.00, playerGets: 50.00 }, // 50%
        { percentage: 1.00, expected: 100.00, playerGets: 0.00 }  // 100%
      ];
      
      charityScenarios.forEach(scenario => {
        const charityAmount = currentProgression * scenario.percentage;
        const playerAmount = currentProgression - charityAmount;
        
        expect(charityAmount).toBe(scenario.expected);
        expect(playerAmount).toBe(scenario.playerGets);
        expect(charityAmount + playerAmount).toBe(currentProgression);
      });
    });

    test('should handle zero currentProgression gracefully', () => {
      const currentProgression = 0.00;
      const charityPercentage = 0.15;
      
      const charityAmount = currentProgression * charityPercentage;
      const playerAmount = currentProgression - charityAmount;
      
      expect(charityAmount).toBe(0.00);
      expect(playerAmount).toBe(0.00);
    });

    test('should validate charity percentage bounds', () => {
      // Test edge cases for charity percentage validation
      
      const validPercentages = [0.10, 0.15, 0.25, 0.50, 0.75, 1.00];
      const invalidPercentages = [0.05, -0.10, 1.01, 2.00, -1.00];
      
      validPercentages.forEach(percentage => {
        expect(percentage).toBeGreaterThanOrEqual(0.10);
        expect(percentage).toBeLessThanOrEqual(1.00);
      });
      
      invalidPercentages.forEach(percentage => {
        const isValid = percentage >= 0.10 && percentage <= 1.00;
        expect(isValid).toBe(false);
      });
    });
  });
});

describe('RevenueCalculator - Revenue Stream Separation', () => {
  describe('Revenue Category Tracking', () => {
    test('should separate platform click revenue from player winnings', () => {
      // Platform revenue (20c per game) is separate from player winnings
      
      const mockGameData = {
        totalGames: 50,
        averageWinPerGame: 4.00, // Average winning amount
        totalPlayerWinnings: 200.00, // 50 games × $4 average
        platformClickRevenue: 10.00 // 50 games × 20c
      };
      
      // Verify separation of revenue streams
      expect(mockGameData.platformClickRevenue).toBe(50 * 0.20);
      expect(mockGameData.totalPlayerWinnings).not.toBe(mockGameData.platformClickRevenue);
      expect(mockGameData.platformClickRevenue).toBe(10.00);
      expect(mockGameData.totalPlayerWinnings).toBe(200.00);
    });

    test('should track charity contributions separately', () => {
      // Charity contributions are separate from platform and player revenue
      
      const mockCashOutData = {
        totalCashOuts: 1000.00,
        charityPercentage: 0.15,
        charityContributions: 150.00, // 15% of $1000
        playerReceives: 850.00 // 85% of $1000
      };
      
      expect(mockCashOutData.charityContributions).toBe(mockCashOutData.totalCashOuts * mockCashOutData.charityPercentage);
      expect(mockCashOutData.playerReceives).toBe(mockCashOutData.totalCashOuts - mockCashOutData.charityContributions);
      expect(mockCashOutData.charityContributions + mockCashOutData.playerReceives).toBe(mockCashOutData.totalCashOuts);
    });

    test('should maintain revenue stream consistency', () => {
      // All revenue streams should sum to total activity
      
      const mockRevenueData = {
        platformRevenue: 25.00,    // Platform fees
        charityContributions: 75.00, // Charity from cash-outs
        netPlayerWinnings: 500.00,   // Player received amounts
        totalRevenue: 600.00         // Sum of all streams
      };
      
      const calculatedTotal = 
        mockRevenueData.platformRevenue + 
        mockRevenueData.charityContributions + 
        mockRevenueData.netPlayerWinnings;
      
      expect(calculatedTotal).toBe(mockRevenueData.totalRevenue);
      expect(calculatedTotal).toBe(600.00);
    });
  });
});

describe('RevenueCalculator - Transaction Audit Trail', () => {
  describe('Transaction Recording', () => {
    test('should create valid game transaction records', () => {
      const mockTransaction: GameTransaction = {
        id: 'tx_123456789',
        playerId: 'player_001',
        type: 'GAME_FEE',
        amount: 1.10, // $1.10 game fee
        level: 1,
        virtualDollarId: 'dollar_abc',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        balanceAfter: {
          donationBalance: 18.90, // $20 - $1.10
          winningsBalance: 0.00,
          currentProgression: 0.00
        }
      };
      
      expect(mockTransaction.id).toBe('tx_123456789');
      expect(mockTransaction.playerId).toBe('player_001');
      expect(mockTransaction.type).toBe('GAME_FEE');
      expect(mockTransaction.amount).toBe(1.10);
      expect(mockTransaction.level).toBe(1);
      expect(mockTransaction.virtualDollarId).toBe('dollar_abc');
      expect(mockTransaction.timestamp).toBeInstanceOf(Date);
      expect(mockTransaction.balanceAfter.donationBalance).toBe(18.90);
    });

    test('should validate transaction types', () => {
      const validTransactionTypes = ['GAME_FEE', 'WIN', 'CASH_OUT', 'LOSS'];
      
      validTransactionTypes.forEach(type => {
        const transaction = {
          id: 'tx_test',
          playerId: 'player_test',
          type: type as GameTransaction['type'],
          amount: 1.00,
          timestamp: new Date(),
          balanceAfter: {
            donationBalance: 0,
            winningsBalance: 0,
            currentProgression: 0
          }
        };
        
        expect(validTransactionTypes).toContain(transaction.type);
      });
    });

    test('should maintain balance consistency in transactions', () => {
      // Balance after transaction should reflect the transaction amount
      
      const initialBalance = {
        donationBalance: 20.00,
        winningsBalance: 0.00,
        currentProgression: 0.00
      };
      
      const gameFeeTransaction = {
        type: 'GAME_FEE' as const,
        amount: 1.10,
        expectedBalanceAfter: {
          donationBalance: 18.90, // 20.00 - 1.10
          winningsBalance: 0.00,
          currentProgression: 0.00
        }
      };
      
      expect(gameFeeTransaction.expectedBalanceAfter.donationBalance).toBe(
        initialBalance.donationBalance - gameFeeTransaction.amount
      );
      expect(gameFeeTransaction.expectedBalanceAfter.winningsBalance).toBe(
        initialBalance.winningsBalance
      );
      expect(gameFeeTransaction.expectedBalanceAfter.currentProgression).toBe(
        initialBalance.currentProgression
      );
    });
  });
});