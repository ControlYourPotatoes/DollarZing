import { Player, GameTransaction, CashOutStrategy, ValidationResult } from './virtual-dollar-engine';
/**
 * Player Balance Manager - Implements 3-part balance system
 * Separates donation balance, winnings balance, and at-risk progression
 */
export declare class PlayerBalanceManager {
    private players;
    private transactionHistory;
    private gameFee;
    /**
     * Create a new player with initial donation balance
     */
    createPlayer(id: string, initialDonation: number, strategy: CashOutStrategy): Player;
    /**
     * Get player by ID
     */
    getPlayer(playerId: string): Player | undefined;
    /**
     * Get all players
     */
    getAllPlayers(): Player[];
    /**
     * Get active players only
     */
    getActivePlayers(): Player[];
    /**
     * Check if player can afford to play a game
     */
    canPlayerPlay(playerId: string): boolean;
    /**
     * Calculate how many games a player can afford
     */
    getPlayerGameCredits(playerId: string): number;
    /**
     * Process game fee deduction from donation balance
     */
    processGameFee(playerId: string): boolean;
    /**
     * Add winning amount to currentProgression balance
     */
    addWinProgression(playerId: string, amount: number): void;
    /**
     * Clear progression on loss, return lost amount
     */
    loseProgression(playerId: string): number;
    /**
     * Process cash-out with charity deduction
     */
    processCashOut(playerId: string, charityPercentage: number): {
        playerAmount: number;
        charityAmount: number;
    };
    /**
     * Get transaction history for a player
     */
    getTransactionHistory(playerId: string): GameTransaction[];
    /**
     * Get total donations across all players
     */
    getTotalDonations(): number;
    /**
     * Get total winnings across all players (including progression)
     */
    getTotalWinnings(): number;
    /**
     * Get total charity contributions from all cash-outs
     */
    getTotalCharityContributions(): number;
    /**
     * Get player statistics
     */
    getPlayerStatistics(playerId: string): {
        totalDeposited: number;
        totalSpentOnFees: number;
        totalWon: number;
        totalCashedOut: number;
        currentBalance: number;
        gamesPlayed: number;
        isActive: boolean;
    };
    /**
     * Validate player balance consistency
     */
    validatePlayerBalance(playerId: string): ValidationResult;
    /**
     * Update player's cash-out strategy
     */
    updatePlayerStrategy(playerId: string, newStrategy: CashOutStrategy): boolean;
    /**
     * Get game fee amount
     */
    getGameFee(): number;
    /**
     * Set game fee (for testing or configuration changes)
     */
    setGameFee(newFee: number): ValidationResult;
    /**
     * Record a transaction in the player's history
     */
    private recordTransaction;
    /**
     * Generate unique transaction ID
     */
    private generateTransactionId;
    /**
     * Round to nearest cent
     */
    private roundToTwoCents;
    /**
     * Reset all players and transactions (for testing)
     */
    reset(): void;
}
export default PlayerBalanceManager;
//# sourceMappingURL=player-balance-manager.d.ts.map