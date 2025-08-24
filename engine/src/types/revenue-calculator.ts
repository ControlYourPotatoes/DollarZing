// Revenue Calculator Implementation - Task 6.2, 6.4, 6.10, 6.12
// Handles platform fee calculation, charity contributions, and revenue tracking

import {
  RevenueStream,
  GameSession,
  ValidationResult,
  createEmptyRevenueStream
} from './virtual-dollar-engine';

/**
 * Revenue Calculator - Manages all revenue streams and financial calculations
 * Separates platform fees, charity contributions, and player winnings
 */
export class RevenueCalculator {
  private revenueStream: RevenueStream;
  private gameTransactionHistory: GameSession[] = [];
  private platformFeePerPlayer = 0.10; // 10 cents per player
  private totalPlayersPerGame = 2; // Always 2 players in 1v1 games
  private cashOutCount = 0; // Track cash-out count separately

  constructor(initialCharityPercentage: number = 0.15) {
    this.revenueStream = createEmptyRevenueStream();
    this.setCharityPercentage(initialCharityPercentage);
  }

  /**
   * Process platform revenue from a game session
   * 10c per player × 2 players = 20c total per game
   */
  processGameRevenue(gameSession: GameSession): ValidationResult {
    try {
      // Validate game session
      const validation = this.validateGameSession(gameSession);
      if (!validation.isValid) {
        return validation;
      }

      // Calculate platform fee (20c per game)
      const platformFeeForGame = this.platformFeePerPlayer * this.totalPlayersPerGame;
      
      // Update revenue stream
      this.revenueStream.platformClickRevenue += platformFeeForGame;
      this.revenueStream.totalClickFees += platformFeeForGame;
      this.revenueStream.totalGames++;
      
      // Track the game
      this.gameTransactionHistory.push(gameSession);
      
      // Validate the fee was added correctly
      if (gameSession.platformFee !== platformFeeForGame) {
        return {
          isValid: false,
          errors: [`Game platform fee mismatch: expected ${platformFeeForGame}, got ${gameSession.platformFee}`],
          warnings: []
        };
      }

      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Error processing game revenue: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * Process cash-out with charity deduction
   * Charity is calculated from currentProgression only
   */
  processCashOut(progressionAmount: number): { playerAmount: number; charityAmount: number; validation: ValidationResult } {
    try {
      // Validate inputs
      if (progressionAmount < 0) {
        return {
          playerAmount: 0,
          charityAmount: 0,
          validation: {
            isValid: false,
            errors: ['Progression amount cannot be negative'],
            warnings: []
          }
        };
      }

      if (progressionAmount === 0) {
        return {
          playerAmount: 0,
          charityAmount: 0,
          validation: {
            isValid: true,
            errors: [],
            warnings: ['Cash-out amount is zero']
          }
        };
      }

      // Calculate charity from currentProgression only
      const charityAmount = progressionAmount * this.revenueStream.charityPercentage;
      const playerAmount = progressionAmount - charityAmount;

      // Update revenue stream
      this.revenueStream.charityContributions += charityAmount;
      this.revenueStream.totalCashOuts += progressionAmount;
      this.revenueStream.playerWinnings += playerAmount;
      this.cashOutCount++;

      // Recalculate average cash-out amount
      this.revenueStream.averageCashOutAmount = this.cashOutCount > 0 
        ? this.revenueStream.totalCashOuts / this.cashOutCount 
        : 0;

      return {
        playerAmount: this.roundToTwoCents(playerAmount),
        charityAmount: this.roundToTwoCents(charityAmount),
        validation: {
          isValid: true,
          errors: [],
          warnings: []
        }
      };
    } catch (error) {
      return {
        playerAmount: 0,
        charityAmount: 0,
        validation: {
          isValid: false,
          errors: [`Error processing cash-out: ${error}`],
          warnings: []
        }
      };
    }
  }

  /**
   * Set charity percentage with validation
   * Must be between 10% (0.10) and 100% (1.00)
   */
  setCharityPercentage(percentage: number): ValidationResult {
    if (percentage < 0.10 || percentage > 1.00) {
      return {
        isValid: false,
        errors: ['Charity percentage must be between 0.10 (10%) and 1.00 (100%)'],
        warnings: []
      };
    }

    if (percentage > 0.50) {
      const result = {
        isValid: true,
        errors: [],
        warnings: [`Charity percentage ${(percentage * 100).toFixed(1)}% is quite high`]
      };
      
      this.revenueStream.charityPercentage = percentage;
      return result;
    }

    this.revenueStream.charityPercentage = percentage;
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Get current charity percentage
   */
  getCharityPercentage(): number {
    return this.revenueStream.charityPercentage;
  }

  /**
   * Get current revenue stream state
   */
  getRevenueStream(): RevenueStream {
    return { ...this.revenueStream }; // Return copy to prevent external modification
  }

  /**
   * Get platform revenue total
   */
  getPlatformRevenue(): number {
    return this.revenueStream.platformClickRevenue;
  }

  /**
   * Get charity contributions total
   */
  getCharityContributions(): number {
    return this.revenueStream.charityContributions;
  }

  /**
   * Get player winnings total (after charity deduction)
   */
  getPlayerWinnings(): number {
    return this.revenueStream.playerWinnings;
  }

  /**
   * Get total games processed
   */
  getTotalGames(): number {
    return this.revenueStream.totalGames;
  }

  /**
   * Get game transaction history
   */
  getGameHistory(): GameSession[] {
    return [...this.gameTransactionHistory]; // Return copy
  }

  /**
   * Generate detailed revenue report
   */
  generateRevenueReport(): {
    summary: RevenueStream;
    breakdown: {
      averageRevenuePerGame: number;
      totalVolume: number;
      platformMargin: number;
      charityImpact: number;
    };
    validation: ValidationResult;
  } {
    try {
      const totalVolume = this.revenueStream.platformClickRevenue + 
                         this.revenueStream.charityContributions + 
                         this.revenueStream.playerWinnings;

      const averageRevenuePerGame = this.revenueStream.totalGames > 0 
        ? this.revenueStream.platformClickRevenue / this.revenueStream.totalGames 
        : 0;

      const platformMargin = totalVolume > 0 
        ? (this.revenueStream.platformClickRevenue / totalVolume) * 100 
        : 0;

      const charityImpact = this.revenueStream.totalCashOuts > 0 
        ? (this.revenueStream.charityContributions / this.revenueStream.totalCashOuts) * 100 
        : 0;

      return {
        summary: { ...this.revenueStream },
        breakdown: {
          averageRevenuePerGame: this.roundToTwoCents(averageRevenuePerGame),
          totalVolume: this.roundToTwoCents(totalVolume),
          platformMargin: this.roundToTwoDecimals(platformMargin),
          charityImpact: this.roundToTwoDecimals(charityImpact)
        },
        validation: {
          isValid: true,
          errors: [],
          warnings: []
        }
      };
    } catch (error) {
      return {
        summary: createEmptyRevenueStream(),
        breakdown: {
          averageRevenuePerGame: 0,
          totalVolume: 0,
          platformMargin: 0,
          charityImpact: 0
        },
        validation: {
          isValid: false,
          errors: [`Error generating revenue report: ${error}`],
          warnings: []
        }
      };
    }
  }

  /**
   * Reset revenue calculator (for testing or new simulations)
   */
  reset(charityPercentage: number = 0.15): ValidationResult {
    try {
      this.revenueStream = createEmptyRevenueStream();
      this.gameTransactionHistory = [];
      this.cashOutCount = 0;
      return this.setCharityPercentage(charityPercentage);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Error resetting revenue calculator: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * Validate game session for revenue processing
   */
  private validateGameSession(gameSession: GameSession): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!gameSession.id) {
      errors.push('Game session ID is required');
    }

    if (!gameSession.dollar1 || !gameSession.dollar2) {
      errors.push('Game session must have two virtual dollars');
    }

    if (!gameSession.winner || !gameSession.loser) {
      errors.push('Game session must identify winner and loser');
    }

    // Validate platform fee
    const expectedFee = this.platformFeePerPlayer * this.totalPlayersPerGame;
    if (Math.abs(gameSession.platformFee - expectedFee) > 0.001) {
      errors.push(`Platform fee should be ${expectedFee}, got ${gameSession.platformFee}`);
    }

    // Validate timestamps
    if (!gameSession.timestamp || gameSession.timestamp > new Date()) {
      errors.push('Game session timestamp is invalid');
    }

    // Validate winnings
    if (gameSession.winnings < 0) {
      errors.push('Game winnings cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Round to nearest cent (two decimal places)
   */
  private roundToTwoCents(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Round to two decimal places for percentages
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Validate amount is not zero or negative (when zero/negative not allowed)
   */
  validateAmount(amount: number, allowZero: boolean = false): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (amount < 0) {
      errors.push('Amount cannot be negative');
    }

    if (!allowZero && amount === 0) {
      errors.push('Amount cannot be zero');
    }

    if (amount > 10000) {
      warnings.push('Amount is unusually high');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get platform fee configuration
   */
  getPlatformFeeConfiguration(): { perPlayer: number; perGame: number; totalPlayers: number } {
    return {
      perPlayer: this.platformFeePerPlayer,
      perGame: this.platformFeePerPlayer * this.totalPlayersPerGame,
      totalPlayers: this.totalPlayersPerGame
    };
  }
}

// Export the class and related types
export default RevenueCalculator;