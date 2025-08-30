import { VirtualDollar, BettingLevel, CashOutStrategy, CashOutDecision, GameResult, ValidationResult } from './virtual-dollar-engine';
/**
 * Run Progression State - Tracks progression through betting levels
 */
export interface RunProgressionState {
    runId: string;
    currentLevel: BettingLevel;
    gamesWonInRun: number;
    currentWinnings: number;
    isComplete: boolean;
    completionReason: 'JACKPOT' | 'CASH_OUT' | 'LOSS' | null;
    completedAt: Date | null;
}
/**
 * Cash-Out Decision Context - Information used to make cash-out decisions
 */
export interface CashOutDecisionContext {
    currentLevel: BettingLevel;
    currentWinnings: number;
    nextBet: number;
    nextPotentialWinnings: number;
    strategy: CashOutStrategy;
    gamesWonInRun: number;
}
/**
 * Run Completion Result - Information about a completed run
 */
export interface RunCompletionResult {
    runId: string;
    finalLevel: BettingLevel;
    totalWinnings: number;
    wasJackpot: boolean;
    wasCashedOut: boolean;
    charityContribution: number;
    playerPayout: number;
    gamesPlayedInRun: number;
}
/**
 * ProgressionManager - Manages independent run betting progression and cash-out logic
 * Handles the exponential betting system where each VirtualDollar represents one complete jackpot attempt
 */
export declare class ProgressionManager {
    private charityPercentage;
    private activeRuns;
    private completedRuns;
    constructor(charityPercentage?: number);
    /**
     * Initialize a new independent run for a virtual dollar
     */
    initializeRun(virtualDollar: VirtualDollar): RunProgressionState;
    /**
     * Process a game result for a run
     */
    processGameResult(virtualDollar: VirtualDollar, result: GameResult): RunProgressionState;
    /**
     * Make cash-out decision based on strategy
     */
    makeCashOutDecision(virtualDollar: VirtualDollar, strategy: CashOutStrategy): CashOutDecision;
    /**
     * Process cash-out decision
     */
    processCashOut(runId: string): RunCompletionResult;
    /**
     * Get current betting amount for a run
     */
    getCurrentBet(runId: string): number;
    /**
     * Get potential winnings for current level
     */
    getPotentialWinnings(runId: string): number;
    /**
     * Get active run state
     */
    getRunState(runId: string): RunProgressionState | null;
    /**
     * Get completed run result
     */
    getCompletedRun(runId: string): RunCompletionResult | null;
    /**
     * Get all active runs
     */
    getActiveRuns(): RunProgressionState[];
    /**
     * Get all completed runs
     */
    getCompletedRuns(): RunCompletionResult[];
    /**
     * Complete a run and calculate final payouts
     */
    private completeRun;
    /**
     * Calculate cash-out decision based on strategy and context
     */
    private calculateCashOutDecision;
    /**
     * Conservative cash-out logic - prefer safety
     */
    private conservativeCashOutLogic;
    /**
     * Balanced cash-out logic - moderate risk
     */
    private balancedCashOutLogic;
    /**
     * Aggressive cash-out logic - high risk, high reward
     */
    private aggressiveCashOutLogic;
    /**
     * Validate progression state
     */
    validateProgression(progression: RunProgressionState): ValidationResult;
}
//# sourceMappingURL=progression-manager.d.ts.map