export declare enum DollarState {
    CREATED = "created",
    POOLED = "pooled",
    IN_GAME = "in-game",
    WON = "won",
    LOST = "lost",
    CASHED_OUT = "cashed-out"
}
export declare enum GameResult {
    WIN = "win",
    LOSS = "loss"
}
export declare enum CashOutDecision {
    CASH_OUT = "cash-out",
    CONTINUE = "continue"
}
export declare enum CashOutStrategy {
    CONSERVATIVE = "conservative",
    BALANCED = "balanced",
    AGGRESSIVE = "aggressive"
}
/**
 * Virtual Dollar - Represents one independent jackpot run from Level 1 to completion
 * Each dollar represents a single attempt at the jackpot, not persistent progression
 */
export interface VirtualDollar {
    id: string;
    serialNumber: string;
    currentScore: number;
    currentLevel: BettingLevel;
    state: DollarState;
    ownerId: string;
    runId: string;
    createdAt: Date;
    gameHistory: GameSession[];
    gamesInThisRun: number;
    currentRunWinnings: number;
    isIndependentRun: boolean;
}
/**
 * Game Session - Represents a single 1v1 game between two virtual dollars
 * Contains complete information about the game outcome and scoring
 */
export interface GameSession {
    id: string;
    dollar1: VirtualDollar;
    dollar2: VirtualDollar;
    winner: VirtualDollar;
    loser: VirtualDollar;
    level: BettingLevel;
    platformFee: number;
    timestamp: Date;
    gameNumber: number;
    dailySeed: string;
    dollar1Score: number;
    dollar2Score: number;
    winnings: number;
    isCompleted: boolean;
    duration: number;
    randomSeed: number;
}
/**
 * Revenue Stream - Tracks all revenue sources separately
 * Platform click revenue is distinct from pot distributions
 */
export interface RevenueStream {
    platformClickRevenue: number;
    charityContributions: number;
    charityPercentage: number;
    playerWinnings: number;
    totalCashOuts: number;
    totalGames: number;
    totalClickFees: number;
    averageCashOutAmount: number;
}
export type BettingLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SerialNumberPattern = string;
/**
 * Cash-Out Strategy Distribution - Controls player behavior distribution
 */
export interface CashOutStrategyDistribution {
    conservative: number;
    balanced: number;
    aggressive: number;
}
/**
 * Simulation Parameters - Configuration for the Virtual Dollar Pool Game Engine
 */
export interface SimulationParameters {
    duration: number;
    initialPlayerCount: number;
    virtualDollarsPerPlayer: number;
    cashOutStrategyDistribution: CashOutStrategyDistribution;
    charityPercentage: number;
    gameMatchingInterval: number;
    maxConcurrentGames: number;
    randomSeed: number;
    playerGrowthRate: number;
}
/**
 * Player Statistics - Aggregated player metrics
 */
export interface PlayerStatistics {
    activePlayerCount: number;
    newPlayerCount: number;
    retainedPlayerCount: number;
    churnedPlayerCount: number;
}
/**
 * Game Statistics - Aggregated game metrics
 */
export interface GameStatistics {
    averageGamesPerDay: number;
    levelDistribution: number[];
    avgTimeToLevel: number[];
}
/**
 * Player Performance Record - Individual player performance tracking
 */
export interface PlayerPerformance {
    playerId: string;
    totalWinnings: number;
    gamesPlayed: number;
    currentLevel: BettingLevel;
    winRate: number;
}
/**
 * Daily Game Report - Comprehensive daily activity summary
 */
export interface DailyGameReport {
    day: number;
    date: Date;
    totalGamesPlayed: number;
    virtualDollarsInPool: number;
    newVirtualDollarsCreated: number;
    cashOutEvents: number;
    revenueGenerated: RevenueStream;
    levelActivitySummary: number[];
    topPlayersByWinnings: PlayerPerformance[];
}
/**
 * Monthly Simulation Result - Complete month simulation outcome
 */
export interface MonthlySimulationResult {
    month: number;
    totalVirtualDollars: number;
    totalGamesPlayed: number;
    totalCashOuts: number;
    revenueStreams: RevenueStream;
    dailyReports: DailyGameReport[];
    playerStatistics: PlayerStatistics;
    gameStatistics: GameStatistics;
}
/**
 * Parameter Validation Result
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Virtual Dollar Validation - Validates virtual dollar data integrity
 */
export declare function validateVirtualDollar(dollar: VirtualDollar): ValidationResult;
/**
 * Simulation Parameters Validation - Validates simulation configuration
 */
export declare function validateSimulationParameters(params: SimulationParameters): ValidationResult;
/**
 * Generate a valid serial number for virtual dollars
 */
export declare function generateSerialNumber(): string;
/**
 * Calculate betting level value in dollars (exponential: 2^(level-1))
 */
export declare function getBettingLevelValue(level: BettingLevel): number;
/**
 * Calculate winning amount for a betting level (double the bet)
 */
export declare function getBettingLevelWinnings(level: BettingLevel): number;
/**
 * Check if a betting level is valid
 */
export declare function isValidBettingLevel(level: number): level is BettingLevel;
/**
 * Create an empty revenue stream
 */
export declare function createEmptyRevenueStream(): RevenueStream;
/**
 * Create default simulation parameters
 */
export declare function createDefaultSimulationParameters(): SimulationParameters;
/**
 * Player - Represents a player with 3-part balance system for realistic fund management
 * Separates donation balance, winnings balance, and at-risk progression
 */
export interface Player {
    id: string;
    donationBalance: number;
    winningsBalance: number;
    currentProgression: number;
    gamesPlayed: number;
    virtualDollars: VirtualDollar[];
    cashOutStrategy: CashOutStrategy;
    isActive: boolean;
    createdAt: Date;
}
/**
 * Game Transaction - Records all financial transactions for audit trail
 */
export interface GameTransaction {
    id: string;
    playerId: string;
    type: 'GAME_FEE' | 'WIN' | 'CASH_OUT' | 'LOSS';
    amount: number;
    level?: BettingLevel;
    virtualDollarId?: string;
    timestamp: Date;
    balanceAfter: {
        donationBalance: number;
        winningsBalance: number;
        currentProgression: number;
    };
}
/**
 * Player Balance Manager - Manages 3-part balance system without tight coupling
 * Handles game fees, progression tracking, and cash-out processing
 */
export interface PlayerBalanceManager {
    createPlayer(id: string, initialDonation: number, strategy: CashOutStrategy): Player;
    getPlayer(playerId: string): Player | undefined;
    getAllPlayers(): Player[];
    getActivePlayers(): Player[];
    canPlayerPlay(playerId: string): boolean;
    getPlayerGameCredits(playerId: string): number;
    processGameFee(playerId: string): boolean;
    addWinProgression(playerId: string, amount: number): void;
    loseProgression(playerId: string): number;
    processCashOut(playerId: string, charityPercentage: number): {
        playerAmount: number;
        charityAmount: number;
    };
    getTransactionHistory(playerId: string): GameTransaction[];
    getTotalDonations(): number;
    getTotalWinnings(): number;
    getTotalCharityContributions(): number;
    getPlayerStatistics(playerId: string): PlayerStatistics;
}
//# sourceMappingURL=virtual-dollar-engine.d.ts.map