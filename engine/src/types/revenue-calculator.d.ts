import { RevenueStream, GameSession, ValidationResult } from './virtual-dollar-engine';
/**
 * Revenue Calculator - Manages all revenue streams and financial calculations
 * Separates platform fees, charity contributions, and player winnings
 */
export declare class RevenueCalculator {
    private revenueStream;
    private gameTransactionHistory;
    private platformFeePerPlayer;
    private totalPlayersPerGame;
    private cashOutCount;
    constructor(initialCharityPercentage?: number);
    /**
     * Process platform revenue from a game session
     * 10c per player × 2 players = 20c total per game
     */
    processGameRevenue(gameSession: GameSession): ValidationResult;
    /**
     * Process cash-out with charity deduction
     * Charity is calculated from currentProgression only
     */
    processCashOut(progressionAmount: number): {
        playerAmount: number;
        charityAmount: number;
        validation: ValidationResult;
    };
    /**
     * Set charity percentage with validation
     * Must be between 10% (0.10) and 100% (1.00)
     */
    setCharityPercentage(percentage: number): ValidationResult;
    /**
     * Get current charity percentage
     */
    getCharityPercentage(): number;
    /**
     * Get current revenue stream state
     */
    getRevenueStream(): RevenueStream;
    /**
     * Get platform revenue total
     */
    getPlatformRevenue(): number;
    /**
     * Get charity contributions total
     */
    getCharityContributions(): number;
    /**
     * Get player winnings total (after charity deduction)
     */
    getPlayerWinnings(): number;
    /**
     * Get total games processed
     */
    getTotalGames(): number;
    /**
     * Get game transaction history
     */
    getGameHistory(): GameSession[];
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
    };
    /**
     * Reset revenue calculator (for testing or new simulations)
     */
    reset(charityPercentage?: number): ValidationResult;
    /**
     * Validate game session for revenue processing
     */
    private validateGameSession;
    /**
     * Round to nearest cent (two decimal places)
     */
    private roundToTwoCents;
    /**
     * Round to two decimal places for percentages
     */
    private roundToTwoDecimals;
    /**
     * Validate amount is not zero or negative (when zero/negative not allowed)
     */
    validateAmount(amount: number, allowZero?: boolean): ValidationResult;
    /**
     * Get platform fee configuration
     */
    getPlatformFeeConfiguration(): {
        perPlayer: number;
        perGame: number;
        totalPlayers: number;
    };
}
export default RevenueCalculator;
//# sourceMappingURL=revenue-calculator.d.ts.map