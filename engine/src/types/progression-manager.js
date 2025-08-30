// Progression Manager - Handles independent run logic for Virtual Dollar Pool Game
// Manages exponential betting progression, cash-out decisions, and run completion
import { CashOutStrategy, CashOutDecision, GameResult, getBettingLevelValue, getBettingLevelWinnings } from './virtual-dollar-engine';
// ===== PROGRESSION MANAGER CLASS =====
/**
 * ProgressionManager - Manages independent run betting progression and cash-out logic
 * Handles the exponential betting system where each VirtualDollar represents one complete jackpot attempt
 */
export class ProgressionManager {
    charityPercentage;
    activeRuns = new Map();
    completedRuns = new Map();
    constructor(charityPercentage = 0.15) {
        this.charityPercentage = charityPercentage;
    }
    /**
     * Initialize a new independent run for a virtual dollar
     */
    initializeRun(virtualDollar) {
        if (this.activeRuns.has(virtualDollar.runId)) {
            throw new Error(`Run ${virtualDollar.runId} already exists`);
        }
        const progressionState = {
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
    processGameResult(virtualDollar, result) {
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
        progression.currentLevel = (progression.currentLevel + 1);
        return progression;
    }
    /**
     * Make cash-out decision based on strategy
     */
    makeCashOutDecision(virtualDollar, strategy) {
        const progression = this.activeRuns.get(virtualDollar.runId);
        if (!progression || progression.isComplete) {
            return CashOutDecision.CASH_OUT;
        }
        // Can't cash out before winning at least one game
        if (progression.gamesWonInRun === 0) {
            return CashOutDecision.CONTINUE;
        }
        const context = {
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
    processCashOut(runId) {
        this.completeRun(runId, 'CASH_OUT');
        return this.completedRuns.get(runId);
    }
    /**
     * Get current betting amount for a run
     */
    getCurrentBet(runId) {
        const progression = this.activeRuns.get(runId);
        if (!progression) {
            throw new Error(`No active run found for ${runId}`);
        }
        return getBettingLevelValue(progression.currentLevel);
    }
    /**
     * Get potential winnings for current level
     */
    getPotentialWinnings(runId) {
        const progression = this.activeRuns.get(runId);
        if (!progression) {
            throw new Error(`No active run found for ${runId}`);
        }
        return getBettingLevelWinnings(progression.currentLevel);
    }
    /**
     * Get active run state
     */
    getRunState(runId) {
        return this.activeRuns.get(runId) || null;
    }
    /**
     * Get completed run result
     */
    getCompletedRun(runId) {
        return this.completedRuns.get(runId) || null;
    }
    /**
     * Get all active runs
     */
    getActiveRuns() {
        return Array.from(this.activeRuns.values());
    }
    /**
     * Get all completed runs
     */
    getCompletedRuns() {
        return Array.from(this.completedRuns.values());
    }
    // ===== PRIVATE METHODS =====
    /**
     * Complete a run and calculate final payouts
     */
    completeRun(runId, reason) {
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
        const completionResult = {
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
    calculateCashOutDecision(context) {
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
    conservativeCashOutLogic(context) {
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
    balancedCashOutLogic(context) {
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
    aggressiveCashOutLogic(_context) {
        // Aggressive players go for jackpots and rarely cash out
        // Never cash out before Level 10 - always go for jackpot
        return CashOutDecision.CONTINUE;
    }
    /**
     * Validate progression state
     */
    validateProgression(progression) {
        const errors = [];
        const warnings = [];
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
//# sourceMappingURL=progression-manager.js.map