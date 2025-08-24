// Progression Manager - Handles independent run logic for Virtual Dollar Pool Game
// Manages exponential betting progression, cash-out decisions, and run completion

import {
  VirtualDollar,
  BettingLevel,
  CashOutStrategy,
  CashOutDecision,
  GameResult,
  ValidationResult,
  getBettingLevelValue,
  getBettingLevelWinnings
} from './virtual-dollar-engine';

// ===== PROGRESSION INTERFACES =====

/**
 * Run Progression State - Tracks progression through betting levels
 */
export interface RunProgressionState {
  runId: string;                          // Unique run identifier
  currentLevel: BettingLevel;             // Current betting level (1-10)
  gamesWonInRun: number;                  // Number of games won in this run
  currentWinnings: number;                // Current winnings that could be cashed out
  isComplete: boolean;                    // Whether this run is finished
  completionReason: 'JACKPOT' | 'CASH_OUT' | 'LOSS' | null; // How the run ended
  completedAt: Date | null;               // When the run was completed
}

/**
 * Cash-Out Decision Context - Information used to make cash-out decisions
 */
export interface CashOutDecisionContext {
  currentLevel: BettingLevel;             // Current betting level
  currentWinnings: number;                // Amount that could be cashed out
  nextBet: number;                        // Amount that would be bet at next level
  nextPotentialWinnings: number;          // Potential winnings if next game is won
  strategy: CashOutStrategy;              // Player's cash-out strategy
  gamesWonInRun: number;                  // Number of games won so far in this run
}

/**
 * Run Completion Result - Information about a completed run
 */
export interface RunCompletionResult {
  runId: string;                          // Completed run ID
  finalLevel: BettingLevel;               // Final level reached
  totalWinnings: number;                  // Total winnings from the run
  wasJackpot: boolean;                    // Whether this was a jackpot win
  wasCashedOut: boolean;                  // Whether player chose to cash out
  charityContribution: number;            // Amount contributed to charity
  playerPayout: number;                   // Net amount paid to player
  gamesPlayedInRun: number;               // Total games in this run
}

// ===== PROGRESSION MANAGER CLASS =====

/**
 * ProgressionManager - Manages independent run betting progression and cash-out logic
 * Handles the exponential betting system where each VirtualDollar represents one complete jackpot attempt
 */
export class ProgressionManager {
  private activeRuns: Map<string, RunProgressionState> = new Map();
  private completedRuns: Map<string, RunCompletionResult> = new Map();
  
  constructor(
    private charityPercentage: number = 0.15
  ) {}

  /**
   * Initialize a new independent run for a virtual dollar
   */
  initializeRun(virtualDollar: VirtualDollar): RunProgressionState {
    if (this.activeRuns.has(virtualDollar.runId)) {
      throw new Error(`Run ${virtualDollar.runId} already exists`);
    }

    const progressionState: RunProgressionState = {
      runId: virtualDollar.runId,
      currentLevel: 1, // Start at Level 1
      gamesWonInRun: 0,
      currentWinnings: 0,
      isComplete: false,
      completionReason: null,
      completedAt: null
    };

    this.activeRuns.set(virtualDollar.runId, progressionState);
    return progressionState;
  }

  /**
   * Process a game result for a run
   */
  processGameResult(virtualDollar: VirtualDollar, result: GameResult): RunProgressionState {
    const progression = this.activeRuns.get(virtualDollar.runId);
    if (!progression) {
      throw new Error(`No active run found for ${virtualDollar.runId}`);
    }

    if (progression.isComplete) {
      throw new Error(`Run ${virtualDollar.runId} is already complete`);
    }

    if (result === GameResult.LOSS) {
      // Player lost - run ends with no winnings
      progression.currentWinnings = 0; // Clear winnings on loss
      return this.completeRun(virtualDollar.runId, 'LOSS');
    }

    // Player won - advance to next level
    progression.gamesWonInRun++;
    
    // Calculate winnings for current level
    const levelWinnings = getBettingLevelWinnings(progression.currentLevel);
    progression.currentWinnings = levelWinnings;

    // Check if this is the jackpot (Level 10)
    if (progression.currentLevel === 10) {
      // Automatic jackpot completion at Level 10
      return this.completeRun(virtualDollar.runId, 'JACKPOT');
    }

    // Advance to next level
    progression.currentLevel = (progression.currentLevel + 1) as BettingLevel;

    return progression;
  }

  /**
   * Make cash-out decision based on strategy
   */
  makeCashOutDecision(virtualDollar: VirtualDollar, strategy: CashOutStrategy): CashOutDecision {
    const progression = this.activeRuns.get(virtualDollar.runId);
    if (!progression || progression.isComplete) {
      return CashOutDecision.CASH_OUT;
    }

    // Can't cash out before winning at least one game
    if (progression.gamesWonInRun === 0) {
      return CashOutDecision.CONTINUE;
    }

    const context: CashOutDecisionContext = {
      currentLevel: progression.currentLevel,
      currentWinnings: progression.currentWinnings,
      nextBet: getBettingLevelValue(progression.currentLevel),
      nextPotentialWinnings: getBettingLevelWinnings(progression.currentLevel),
      strategy,
      gamesWonInRun: progression.gamesWonInRun
    };

    return this.calculateCashOutDecision(context);
  }

  /**
   * Process cash-out decision
   */
  processCashOut(runId: string): RunCompletionResult {
    this.completeRun(runId, 'CASH_OUT');
    return this.completedRuns.get(runId)!;
  }

  /**
   * Get current betting amount for a run
   */
  getCurrentBet(runId: string): number {
    const progression = this.activeRuns.get(runId);
    if (!progression) {
      throw new Error(`No active run found for ${runId}`);
    }
    return getBettingLevelValue(progression.currentLevel);
  }

  /**
   * Get potential winnings for current level
   */
  getPotentialWinnings(runId: string): number {
    const progression = this.activeRuns.get(runId);
    if (!progression) {
      throw new Error(`No active run found for ${runId}`);
    }
    return getBettingLevelWinnings(progression.currentLevel);
  }

  /**
   * Get active run state
   */
  getRunState(runId: string): RunProgressionState | null {
    return this.activeRuns.get(runId) || null;
  }

  /**
   * Get completed run result
   */
  getCompletedRun(runId: string): RunCompletionResult | null {
    return this.completedRuns.get(runId) || null;
  }

  /**
   * Get all active runs
   */
  getActiveRuns(): RunProgressionState[] {
    return Array.from(this.activeRuns.values());
  }

  /**
   * Get all completed runs
   */
  getCompletedRuns(): RunCompletionResult[] {
    return Array.from(this.completedRuns.values());
  }

  // ===== PRIVATE METHODS =====

  /**
   * Complete a run and calculate final payouts
   */
  private completeRun(runId: string, reason: 'JACKPOT' | 'CASH_OUT' | 'LOSS'): RunProgressionState {
    const progression = this.activeRuns.get(runId);
    if (!progression) {
      throw new Error(`No active run found for ${runId}`);
    }

    progression.isComplete = true;
    progression.completionReason = reason;
    progression.completedAt = new Date();

    // Calculate final payouts
    const totalWinnings = progression.currentWinnings;
    let charityContribution = 0;
    let playerPayout = 0;

    if (reason === 'CASH_OUT' || reason === 'JACKPOT') {
      charityContribution = totalWinnings * this.charityPercentage;
      playerPayout = totalWinnings - charityContribution;
    }

    // Store completion result
    const completionResult: RunCompletionResult = {
      runId: progression.runId,
      finalLevel: progression.currentLevel,
      totalWinnings,
      wasJackpot: reason === 'JACKPOT',
      wasCashedOut: reason === 'CASH_OUT',
      charityContribution,
      playerPayout,
      gamesPlayedInRun: progression.gamesWonInRun + (reason === 'LOSS' ? 1 : 0)
    };

    this.completedRuns.set(runId, completionResult);

    // Remove from active runs
    this.activeRuns.delete(runId);

    return progression;
  }

  /**
   * Calculate cash-out decision based on strategy and context
   */
  private calculateCashOutDecision(context: CashOutDecisionContext): CashOutDecision {
    switch (context.strategy) {
      case CashOutStrategy.CONSERVATIVE:
        return this.conservativeCashOutLogic(context);
      case CashOutStrategy.BALANCED:
        return this.balancedCashOutLogic(context);
      case CashOutStrategy.AGGRESSIVE:
        return this.aggressiveCashOutLogic(context);
      default:
        return CashOutDecision.CASH_OUT;
    }
  }

  /**
   * Conservative cash-out logic - prefer safety
   */
  private conservativeCashOutLogic(context: CashOutDecisionContext): CashOutDecision {
    // Conservative players cash out early to secure winnings
    if (context.currentLevel >= 3 && context.currentWinnings >= 8) {
      return CashOutDecision.CASH_OUT;
    }
    if (context.currentLevel >= 5) {
      return CashOutDecision.CASH_OUT;
    }
    return CashOutDecision.CONTINUE;
  }

  /**
   * Balanced cash-out logic - moderate risk
   */
  private balancedCashOutLogic(context: CashOutDecisionContext): CashOutDecision {
    // Balanced players aim for mid-range levels
    if (context.currentLevel >= 6 && context.currentWinnings >= 64) {
      return CashOutDecision.CASH_OUT;
    }
    if (context.currentLevel >= 8) {
      return CashOutDecision.CASH_OUT;
    }
    return CashOutDecision.CONTINUE;
  }

  /**
   * Aggressive cash-out logic - high risk, high reward
   */
  private aggressiveCashOutLogic(_context: CashOutDecisionContext): CashOutDecision {
    // Aggressive players go for jackpots and rarely cash out
    // Never cash out before Level 10 - always go for jackpot
    return CashOutDecision.CONTINUE;
  }

  /**
   * Validate progression state
   */
  validateProgression(progression: RunProgressionState): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!progression.runId || progression.runId.trim() === '') {
      errors.push('Run ID is required');
    }

    if (progression.currentLevel < 1 || progression.currentLevel > 10) {
      errors.push('Current level must be between 1 and 10');
    }

    if (progression.gamesWonInRun < 0) {
      errors.push('Games won in run cannot be negative');
    }

    if (progression.currentWinnings < 0) {
      errors.push('Current winnings cannot be negative');
    }

    if (progression.isComplete && !progression.completionReason) {
      errors.push('Completion reason is required for completed runs');
    }

    if (progression.isComplete && !progression.completedAt) {
      errors.push('Completion timestamp is required for completed runs');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}