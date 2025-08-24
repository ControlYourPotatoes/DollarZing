// Player Balance Manager Integration Tests - Task 6.6, 6.8, 6.12
// Integration tests for PlayerBalanceManager with real implementation

import {
  CashOutStrategy
} from '../src/types/virtual-dollar-engine';
import { PlayerBalanceManager } from '../src/types/player-balance-manager';

describe('PlayerBalanceManager - Integration Tests', () => {
  let balanceManager: PlayerBalanceManager;

  beforeEach(() => {
    balanceManager = new PlayerBalanceManager();
  });

  describe('Real Implementation Tests', () => {
    test('should create and manage players correctly', () => {
      const player = balanceManager.createPlayer('player1', 20.00, CashOutStrategy.BALANCED);
      
      expect(player.id).toBe('player1');
      expect(player.donationBalance).toBe(20.00);
      expect(player.winningsBalance).toBe(0.00);
      expect(player.currentProgression).toBe(0.00);
      expect(player.cashOutStrategy).toBe(CashOutStrategy.BALANCED);
      expect(player.isActive).toBe(true);
      expect(player.gamesPlayed).toBe(0);
    });

    test('should handle game fee processing correctly', () => {
      balanceManager.createPlayer('player1', 5.50, CashOutStrategy.CONSERVATIVE);
      
      // Player can afford exactly 5 games (5.50 ÷ 1.10 = 5)
      expect(balanceManager.getPlayerGameCredits('player1')).toBe(5);
      expect(balanceManager.canPlayerPlay('player1')).toBe(true);
      
      // Process 4 game fees
      for (let i = 0; i < 4; i++) {
        const success = balanceManager.processGameFee('player1');
        expect(success).toBe(true);
      }
      
      const player = balanceManager.getPlayer('player1');
      expect(player?.donationBalance).toBe(1.10); // 5.50 - (4 × 1.10)
      expect(player?.gamesPlayed).toBe(4);
      expect(player?.isActive).toBe(true); // Can still afford 1 more game
      
      // Process final game fee
      const finalSuccess = balanceManager.processGameFee('player1');
      expect(finalSuccess).toBe(true);
      
      const finalPlayer = balanceManager.getPlayer('player1');
      expect(finalPlayer?.donationBalance).toBe(0.00);
      expect(finalPlayer?.gamesPlayed).toBe(5);
      expect(finalPlayer?.isActive).toBe(false); // Now inactive
    });

    test('should handle winning progression correctly', () => {
      balanceManager.createPlayer('player1', 10.00, CashOutStrategy.AGGRESSIVE);
      
      // Simulate exponential progression: Level 1 → 2 → 3 → 4
      const winSequence = [2.00, 4.00, 8.00, 16.00];
      let expectedProgression = 0.00;
      
      winSequence.forEach(winAmount => {
        balanceManager.addWinProgression('player1', winAmount);
        expectedProgression += winAmount;
        
        const player = balanceManager.getPlayer('player1');
        expect(player?.currentProgression).toBe(expectedProgression);
      });
      
      const finalPlayer = balanceManager.getPlayer('player1');
      expect(finalPlayer?.currentProgression).toBe(30.00); // 2+4+8+16
      expect(finalPlayer?.winningsBalance).toBe(0.00); // Not cashed out yet
    });

    test('should handle loss and progression reset correctly', () => {
      balanceManager.createPlayer('player1', 10.00, CashOutStrategy.BALANCED);
      
      // Build up progression
      balanceManager.addWinProgression('player1', 2.00);
      balanceManager.addWinProgression('player1', 4.00);
      balanceManager.addWinProgression('player1', 8.00);
      
      let player = balanceManager.getPlayer('player1');
      expect(player?.currentProgression).toBe(14.00);
      
      // Lose progression
      const lostAmount = balanceManager.loseProgression('player1');
      expect(lostAmount).toBe(14.00);
      
      player = balanceManager.getPlayer('player1');
      expect(player?.currentProgression).toBe(0.00);
      expect(player?.winningsBalance).toBe(0.00); // Loss doesn't add to winnings
    });

    test('should process cash-out with charity correctly', () => {
      balanceManager.createPlayer('player1', 20.00, CashOutStrategy.CONSERVATIVE);
      
      // Build up progression
      balanceManager.addWinProgression('player1', 32.00); // Level 5 progression
      
      // Cash out with 15% charity
      const cashOutResult = balanceManager.processCashOut('player1', 0.15);
      expect(cashOutResult.charityAmount).toBe(4.80); // 15% of $32
      expect(cashOutResult.playerAmount).toBe(27.20); // 85% of $32
      
      const player = balanceManager.getPlayer('player1');
      expect(player?.currentProgression).toBe(0.00); // Cleared after cash-out
      expect(player?.winningsBalance).toBe(27.20); // Player amount added to winnings
      expect(player?.donationBalance).toBe(20.00); // Unchanged
    });

    test('should maintain transaction history correctly', () => {
      balanceManager.createPlayer('player1', 15.00, CashOutStrategy.BALANCED);
      
      // Process game fee
      balanceManager.processGameFee('player1');
      
      // Win some money
      balanceManager.addWinProgression('player1', 4.00);
      balanceManager.addWinProgression('player1', 8.00);
      
      // Cash out
      balanceManager.processCashOut('player1', 0.20); // 20% charity
      
      // Check transaction history
      const history = balanceManager.getTransactionHistory('player1');
      expect(history).toHaveLength(4); // 1 game fee + 2 wins + 1 cash-out
      
      expect(history[0].type).toBe('GAME_FEE');
      expect(history[0].amount).toBe(1.10);
      
      expect(history[1].type).toBe('WIN');
      expect(history[1].amount).toBe(4.00);
      
      expect(history[2].type).toBe('WIN');
      expect(history[2].amount).toBe(8.00);
      
      expect(history[3].type).toBe('CASH_OUT');
      expect(history[3].amount).toBe(12.00); // Total progression
    });

    test('should calculate player statistics correctly', () => {
      balanceManager.createPlayer('player1', 25.00, CashOutStrategy.AGGRESSIVE);
      
      // Play some games
      balanceManager.processGameFee('player1'); // Game 1
      balanceManager.addWinProgression('player1', 2.00);
      
      balanceManager.processGameFee('player1'); // Game 2  
      balanceManager.addWinProgression('player1', 4.00);
      
      balanceManager.processGameFee('player1'); // Game 3
      balanceManager.loseProgression('player1'); // Lose progression
      
      // Cash out previous winnings
      balanceManager.addWinProgression('player1', 16.00);
      balanceManager.processCashOut('player1', 0.10); // 10% charity
      
      const stats = balanceManager.getPlayerStatistics('player1');
      
      expect(stats.totalDeposited).toBe(25.00);
      expect(stats.totalSpentOnFees).toBe(3.30); // 3 games × $1.10
      expect(stats.totalWon).toBe(22.00); // 2+4+16
      expect(stats.totalCashedOut).toBe(16.00); // Last progression only
      expect(stats.gamesPlayed).toBe(3);
      expect(stats.isActive).toBe(true);
      expect(stats.currentBalance).toBe(36.10); // 21.70 donation + 14.40 winnings + 0 progression
    });

    test('should handle multiple players independently', () => {
      // Create multiple players
      balanceManager.createPlayer('conservative', 10.00, CashOutStrategy.CONSERVATIVE);
      balanceManager.createPlayer('balanced', 15.00, CashOutStrategy.BALANCED);
      balanceManager.createPlayer('aggressive', 20.00, CashOutStrategy.AGGRESSIVE);
      
      // Process different scenarios for each
      
      // Conservative player: Play safe, cash out early
      balanceManager.processGameFee('conservative');
      balanceManager.addWinProgression('conservative', 2.00);
      balanceManager.processCashOut('conservative', 0.15);
      
      // Balanced player: Play medium risk
      balanceManager.processGameFee('balanced');
      balanceManager.addWinProgression('balanced', 2.00);
      balanceManager.processGameFee('balanced');
      balanceManager.addWinProgression('balanced', 4.00);
      balanceManager.processCashOut('balanced', 0.15);
      
      // Aggressive player: High risk, lose everything
      balanceManager.processGameFee('aggressive');
      balanceManager.addWinProgression('aggressive', 2.00);
      balanceManager.processGameFee('aggressive');
      balanceManager.addWinProgression('aggressive', 4.00);
      balanceManager.processGameFee('aggressive');
      balanceManager.loseProgression('aggressive');
      
      // Verify independent states
      const conservative = balanceManager.getPlayer('conservative');
      const balanced = balanceManager.getPlayer('balanced');
      const aggressive = balanceManager.getPlayer('aggressive');
      
      expect(conservative?.winningsBalance).toBe(1.70); // 85% of $2
      expect(balanced?.winningsBalance).toBe(5.10); // 85% of $6
      expect(aggressive?.winningsBalance).toBe(0.00); // Lost everything
      
      expect(conservative?.gamesPlayed).toBe(1);
      expect(balanced?.gamesPlayed).toBe(2);
      expect(aggressive?.gamesPlayed).toBe(3);
    });

    test('should validate player balance consistency', () => {
      balanceManager.createPlayer('player1', 20.00, CashOutStrategy.BALANCED);
      
      // Perform some operations
      balanceManager.processGameFee('player1');
      balanceManager.addWinProgression('player1', 8.00);
      
      // Validate consistency
      const validation = balanceManager.validatePlayerBalance('player1');
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Test non-existent player
      const invalidValidation = balanceManager.validatePlayerBalance('nonexistent');
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors).toContain('Player nonexistent not found');
    });

    test('should handle game fee changes correctly', () => {
      balanceManager.createPlayer('player1', 10.00, CashOutStrategy.BALANCED);
      
      // Default fee is $1.10
      expect(balanceManager.getGameFee()).toBe(1.10);
      expect(balanceManager.getPlayerGameCredits('player1')).toBe(9); // 10.00 ÷ 1.10 = 9.09 → 9
      
      // Change fee to $2.00
      const feeResult = balanceManager.setGameFee(2.00);
      expect(feeResult.isValid).toBe(true);
      expect(balanceManager.getGameFee()).toBe(2.00);
      expect(balanceManager.getPlayerGameCredits('player1')).toBe(5); // 10.00 ÷ 2.00 = 5
      
      // Test invalid fee
      const invalidFeeResult = balanceManager.setGameFee(-1.00);
      expect(invalidFeeResult.isValid).toBe(false);
      expect(invalidFeeResult.errors).toContain('Game fee must be positive');
    });

    test('should handle retirement scenarios correctly', () => {
      // Create player with minimal balance
      balanceManager.createPlayer('retiringPlayer', 2.20, CashOutStrategy.CONSERVATIVE); // Exactly 2 games
      
      expect(balanceManager.canPlayerPlay('retiringPlayer')).toBe(true);
      expect(balanceManager.getPlayerGameCredits('retiringPlayer')).toBe(2);
      
      // Play first game
      balanceManager.processGameFee('retiringPlayer');
      expect(balanceManager.canPlayerPlay('retiringPlayer')).toBe(true);
      
      // Play second game - player should become inactive
      balanceManager.processGameFee('retiringPlayer');
      expect(balanceManager.canPlayerPlay('retiringPlayer')).toBe(false);
      
      const retiredPlayer = balanceManager.getPlayer('retiringPlayer');
      expect(retiredPlayer?.isActive).toBe(false);
      expect(retiredPlayer?.donationBalance).toBe(0.00);
      expect(retiredPlayer?.gamesPlayed).toBe(2);
      
      // Attempt to process another game fee should fail
      const shouldFail = balanceManager.processGameFee('retiringPlayer');
      expect(shouldFail).toBe(false);
    });

    test('should handle edge cases and error conditions', () => {
      // Test creating player with invalid ID
      expect(() => {
        balanceManager.createPlayer('', 10.00, CashOutStrategy.BALANCED);
      }).toThrow('Player ID is required');
      
      // Test creating player with negative donation
      expect(() => {
        balanceManager.createPlayer('player1', -5.00, CashOutStrategy.BALANCED);
      }).toThrow('Initial donation cannot be negative');
      
      // Test duplicate player creation
      balanceManager.createPlayer('player1', 10.00, CashOutStrategy.BALANCED);
      expect(() => {
        balanceManager.createPlayer('player1', 15.00, CashOutStrategy.AGGRESSIVE);
      }).toThrow('Player with ID player1 already exists');
      
      // Test operations on non-existent player
      expect(() => {
        balanceManager.addWinProgression('nonexistent', 5.00);
      }).toThrow('Player nonexistent not found');
      
      // Test negative win amount
      balanceManager.createPlayer('player2', 10.00, CashOutStrategy.BALANCED);
      expect(() => {
        balanceManager.addWinProgression('player2', -5.00);
      }).toThrow('Win amount cannot be negative');
    });

    test('should calculate aggregate statistics correctly', () => {
      // Create multiple players with different scenarios
      balanceManager.createPlayer('player1', 20.00, CashOutStrategy.BALANCED);
      balanceManager.createPlayer('player2', 15.00, CashOutStrategy.AGGRESSIVE);
      balanceManager.createPlayer('player3', 25.00, CashOutStrategy.CONSERVATIVE);
      
      // Player 1: Some games, some winnings
      balanceManager.processGameFee('player1');
      balanceManager.addWinProgression('player1', 4.00);
      balanceManager.processCashOut('player1', 0.15);
      
      // Player 2: Games and losses
      balanceManager.processGameFee('player2');
      balanceManager.addWinProgression('player2', 8.00);
      balanceManager.loseProgression('player2');
      
      // Player 3: Just game fees, no progression
      balanceManager.processGameFee('player3');
      balanceManager.processGameFee('player3');
      
      // Check aggregates
      const totalDonations = balanceManager.getTotalDonations();
      expect(totalDonations).toBe(60.00); // 20+15+25
      
      const totalWinnings = balanceManager.getTotalWinnings();
      expect(totalWinnings).toBe(3.40); // Player 1's winnings balance (4.00 × 85%)
      
      // Verify active players
      const activePlayers = balanceManager.getActivePlayers();
      expect(activePlayers).toHaveLength(3); // All still active
      
      const allPlayers = balanceManager.getAllPlayers();
      expect(allPlayers).toHaveLength(3);
    });
  });
});