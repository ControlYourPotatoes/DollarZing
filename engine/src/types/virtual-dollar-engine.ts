// Virtual Dollar Pool Game Engine - Core Data Structures & Type Definitions
// Complete TypeScript interfaces for the new game simulation engine
// Supports individual virtual dollars, 1v1 matching, and authentic game mechanics

// ===== ENUMS =====

export enum DollarState {
  CREATED = 'created',
  POOLED = 'pooled',
  IN_GAME = 'in-game',
  WON = 'won',
  LOST = 'lost',
  CASHED_OUT = 'cashed-out'
}

export enum GameResult {
  WIN = 'win',
  LOSS = 'loss'
}

export enum CashOutDecision {
  CASH_OUT = 'cash-out',
  CONTINUE = 'continue'
}

export enum CashOutStrategy {
  CONSERVATIVE = 'conservative',
  BALANCED = 'balanced',
  AGGRESSIVE = 'aggressive'
}

// ===== CORE INTERFACES =====

/**
 * Virtual Dollar - Represents an individual dollar bill in the game
 * Each dollar has a unique serial number and tracks its complete lifecycle
 */
export interface VirtualDollar {
  id: string;                           // Unique identifier for this virtual dollar
  serialNumber: string;                 // Format: letter + 8 digits + letter (e.g., "L12345678A")
  currentScore: number;                 // Current algorithmic score (0-1)
  currentLevel: BettingLevel;           // Current betting level (1-11)
  state: DollarState;                   // Current lifecycle state
  ownerId: string;                      // ID of the player who owns this dollar
  createdAt: Date;                      // When this virtual dollar was created
  gameHistory: GameSession[];           // Complete history of games played
  totalGamesPlayed: number;             // Total number of games participated in
  totalWinnings: number;                // Total amount won across all games
  totalLosses: number;                  // Total amount lost across all games
}

/**
 * Game Session - Represents a single 1v1 game between two virtual dollars
 * Contains complete information about the game outcome and scoring
 */
export interface GameSession {
  id: string;                           // Unique game identifier
  dollar1: VirtualDollar;               // First virtual dollar in the game
  dollar2: VirtualDollar;               // Second virtual dollar in the game
  winner: VirtualDollar;                // The winning virtual dollar
  loser: VirtualDollar;                 // The losing virtual dollar
  level: BettingLevel;                  // Betting level at which this game was played
  platformFee: number;                  // Platform fee collected (20c)
  timestamp: Date;                      // When the game was played
  gameNumber: number;                   // Sequential game number for tracking
  dailySeed: string;                    // Daily seed used for scoring algorithms
  dollar1Score: number;                 // Algorithmic score for dollar1
  dollar2Score: number;                 // Algorithmic score for dollar2
  winnings: number;                     // Total winnings amount for this level
}

/**
 * Revenue Stream - Tracks all revenue sources separately
 * Platform click revenue is distinct from pot distributions
 */
export interface RevenueStream {
  platformClickRevenue: number;         // Revenue from 20c per game click fees
  charityContributions: number;         // Total charity contributions from cash-outs
  charityPercentage: number;            // Percentage of cash-outs going to charity (10-100%)
  playerWinnings: number;               // Total amount won by players
  totalCashOuts: number;                // Total amount cashed out by players
  totalGames: number;                   // Total number of games played
  totalClickFees: number;               // Total click fees collected
  averageCashOutAmount: number;         // Average cash-out amount per player
}

// ===== TYPE ALIASES =====

export type BettingLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type SerialNumberPattern = string; // Format: /^[A-Z]\d{8}[A-Z]$/

// ===== SIMULATION PARAMETERS =====

/**
 * Cash-Out Strategy Distribution - Controls player behavior distribution
 */
export interface CashOutStrategyDistribution {
  conservative: number;                 // Percentage of players using conservative strategy (0-1)
  balanced: number;                     // Percentage of players using balanced strategy (0-1)
  aggressive: number;                   // Percentage of players using aggressive strategy (0-1)
}

/**
 * Simulation Parameters - Configuration for the Virtual Dollar Pool Game Engine
 */
export interface SimulationParameters {
  duration: number;                     // Simulation duration in days
  initialPlayerCount: number;           // Starting number of players
  virtualDollarsPerPlayer: number;      // Average virtual dollars per player per day
  cashOutStrategyDistribution: CashOutStrategyDistribution;
  charityPercentage: number;            // Percentage of cash-outs donated to charity (0.10-1.00)
  gameMatchingInterval: number;         // Milliseconds between game matching attempts
  maxConcurrentGames: number;           // Maximum number of simultaneous games
  randomSeed: number;                   // Seed for reproducible random number generation
  playerGrowthRate: number;             // Daily player growth rate (0-1)
}

// ===== REPORTING INTERFACES =====

/**
 * Player Statistics - Aggregated player metrics
 */
export interface PlayerStatistics {
  activePlayerCount: number;            // Number of currently active players
  newPlayerCount: number;               // Number of new players this period
  retainedPlayerCount: number;          // Number of players retained from previous period
  churnedPlayerCount: number;           // Number of players who stopped playing
}

/**
 * Game Statistics - Aggregated game metrics
 */
export interface GameStatistics {
  averageGamesPerDay: number;           // Average number of games played daily
  levelDistribution: number[];          // Number of games played at each level [1-11]
  avgTimeToLevel: number[];             // Average time to reach each level (minutes)
}

/**
 * Player Performance Record - Individual player performance tracking
 */
export interface PlayerPerformance {
  playerId: string;                     // Player identifier
  totalWinnings: number;                // Total amount won by this player
  gamesPlayed: number;                  // Total games played
  currentLevel: BettingLevel;           // Current highest level reached
  winRate: number;                      // Win percentage (0-1)
}

/**
 * Daily Game Report - Comprehensive daily activity summary
 */
export interface DailyGameReport {
  day: number;                          // Day number (1-based)
  date: Date;                           // Calendar date
  totalGamesPlayed: number;             // Total games played this day
  virtualDollarsInPool: number;         // Number of virtual dollars in the matching pool
  newVirtualDollarsCreated: number;     // New virtual dollars created today
  cashOutEvents: number;                // Number of cash-out events
  revenueGenerated: RevenueStream;      // Revenue breakdown for the day
  levelActivitySummary: number[];       // Games played at each level [1-11]
  topPlayersByWinnings: PlayerPerformance[]; // Top performing players
}

/**
 * Monthly Simulation Result - Complete month simulation outcome
 */
export interface MonthlySimulationResult {
  month: number;                        // Month number (1-12)
  totalVirtualDollars: number;          // Total virtual dollars created this month
  totalGamesPlayed: number;             // Total games played this month
  totalCashOuts: number;                // Total cash-out events
  revenueStreams: RevenueStream;        // Aggregated revenue for the month
  dailyReports: DailyGameReport[];      // Daily reports for each day
  playerStatistics: PlayerStatistics;   // Aggregated player metrics
  gameStatistics: GameStatistics;       // Aggregated game metrics
}

// ===== VALIDATION SCHEMAS =====

/**
 * Parameter Validation Result
 */
export interface ValidationResult {
  isValid: boolean;                     // Whether the parameters are valid
  errors: string[];                     // List of validation errors
  warnings: string[];                   // List of validation warnings
}

/**
 * Virtual Dollar Validation - Validates virtual dollar data integrity
 */
export function validateVirtualDollar(dollar: VirtualDollar): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate serial number format
  if (!dollar.serialNumber.match(/^[A-Z]\d{8}[A-Z]$/)) {
    errors.push('Serial number must follow format: letter + 8 digits + letter');
  }

  // Validate score range
  if (dollar.currentScore < 0 || dollar.currentScore > 1) {
    errors.push('Current score must be between 0 and 1');
  }

  // Validate level range
  if (dollar.currentLevel < 1 || dollar.currentLevel > 11) {
    errors.push('Current level must be between 1 and 11');
  }

  // Validate state
  if (!Object.values(DollarState).includes(dollar.state)) {
    errors.push('Invalid dollar state');
  }

  // Validate financial consistency
  if (dollar.totalGamesPlayed < 0) {
    errors.push('Total games played cannot be negative');
  }

  if (dollar.totalWinnings < 0) {
    errors.push('Total winnings cannot be negative');
  }

  if (dollar.totalLosses < 0) {
    errors.push('Total losses cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Simulation Parameters Validation - Validates simulation configuration
 */
export function validateSimulationParameters(params: SimulationParameters): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate duration
  if (params.duration <= 0) {
    errors.push('Duration must be positive');
  }

  if (params.duration > 365) {
    warnings.push('Duration longer than 1 year may impact performance');
  }

  // Validate player count
  if (params.initialPlayerCount <= 0) {
    errors.push('Initial player count must be positive');
  }

  // Validate virtual dollars per player
  if (params.virtualDollarsPerPlayer <= 0) {
    errors.push('Virtual dollars per player must be positive');
  }

  if (params.virtualDollarsPerPlayer > 20) {
    warnings.push('High virtual dollars per player may impact performance');
  }

  // Validate strategy distribution
  const total = params.cashOutStrategyDistribution.conservative + 
                params.cashOutStrategyDistribution.balanced + 
                params.cashOutStrategyDistribution.aggressive;

  if (Math.abs(total - 1.0) > 0.001) {
    errors.push('Cash-out strategy distribution must sum to 1.0');
  }

  // Validate charity percentage
  if (params.charityPercentage < 0.10 || params.charityPercentage > 1.0) {
    errors.push('Charity percentage must be between 0.10 (10%) and 1.0 (100%)');
  }

  // Validate game matching interval
  if (params.gameMatchingInterval < 1) {
    errors.push('Game matching interval must be at least 1 millisecond');
  }

  // Validate concurrent games
  if (params.maxConcurrentGames < 1) {
    errors.push('Max concurrent games must be at least 1');
  }

  if (params.maxConcurrentGames > 100000) {
    warnings.push('Very high concurrent game limit may impact performance');
  }

  // Validate growth rate
  if (params.playerGrowthRate < 0) {
    errors.push('Player growth rate cannot be negative');
  }

  if (params.playerGrowthRate > 1.0) {
    warnings.push('Growth rate above 100% per day seems unrealistic');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Generate a valid serial number for virtual dollars
 */
export function generateSerialNumber(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const firstLetter = letters[Math.floor(Math.random() * letters.length)];
  const lastLetter = letters[Math.floor(Math.random() * letters.length)];
  const digits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  
  return `${firstLetter}${digits}${lastLetter}`;
}

/**
 * Calculate betting level value in dollars
 */
export function getBettingLevelValue(level: BettingLevel): number {
  const values = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
  return values[level - 1];
}

/**
 * Check if a betting level is valid
 */
export function isValidBettingLevel(level: number): level is BettingLevel {
  return level >= 1 && level <= 11 && Number.isInteger(level);
}

/**
 * Create an empty revenue stream
 */
export function createEmptyRevenueStream(): RevenueStream {
  return {
    platformClickRevenue: 0,
    charityContributions: 0,
    charityPercentage: 0.15, // Default 15%
    playerWinnings: 0,
    totalCashOuts: 0,
    totalGames: 0,
    totalClickFees: 0,
    averageCashOutAmount: 0
  };
}

/**
 * Create default simulation parameters
 */
export function createDefaultSimulationParameters(): SimulationParameters {
  return {
    duration: 30,
    initialPlayerCount: 1000,
    virtualDollarsPerPlayer: 5,
    cashOutStrategyDistribution: {
      conservative: 0.40,
      balanced: 0.40,
      aggressive: 0.20
    },
    charityPercentage: 0.15,
    gameMatchingInterval: 100,
    maxConcurrentGames: 1000,
    randomSeed: Math.floor(Math.random() * 1000000),
    playerGrowthRate: 0.02
  };
}