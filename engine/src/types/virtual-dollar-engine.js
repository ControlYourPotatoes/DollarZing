// Virtual Dollar Pool Game Engine - Core Data Structures & Type Definitions
// Complete TypeScript interfaces for the new game simulation engine
// Supports individual virtual dollars, 1v1 matching, and authentic game mechanics
// ===== ENUMS =====
export var DollarState;
(function (DollarState) {
    DollarState["CREATED"] = "created";
    DollarState["POOLED"] = "pooled";
    DollarState["IN_GAME"] = "in-game";
    DollarState["WON"] = "won";
    DollarState["LOST"] = "lost";
    DollarState["CASHED_OUT"] = "cashed-out";
})(DollarState || (DollarState = {}));
export var GameResult;
(function (GameResult) {
    GameResult["WIN"] = "win";
    GameResult["LOSS"] = "loss";
})(GameResult || (GameResult = {}));
export var CashOutDecision;
(function (CashOutDecision) {
    CashOutDecision["CASH_OUT"] = "cash-out";
    CashOutDecision["CONTINUE"] = "continue";
})(CashOutDecision || (CashOutDecision = {}));
export var CashOutStrategy;
(function (CashOutStrategy) {
    CashOutStrategy["CONSERVATIVE"] = "conservative";
    CashOutStrategy["BALANCED"] = "balanced";
    CashOutStrategy["AGGRESSIVE"] = "aggressive";
})(CashOutStrategy || (CashOutStrategy = {}));
/**
 * Virtual Dollar Validation - Validates virtual dollar data integrity
 */
export function validateVirtualDollar(dollar) {
    const errors = [];
    const warnings = [];
    // Validate serial number format
    if (!dollar.serialNumber.match(/^[A-Z]\d{8}[A-Z]$/)) {
        errors.push('Serial number must follow format: letter + 8 digits + letter');
    }
    // Validate score range
    if (dollar.currentScore < 0 || dollar.currentScore > 1) {
        errors.push('Current score must be between 0 and 1');
    }
    // Validate level range
    if (dollar.currentLevel < 1 || dollar.currentLevel > 10) {
        errors.push('Current level must be between 1 and 10');
    }
    // Validate state
    if (!Object.values(DollarState).includes(dollar.state)) {
        errors.push('Invalid dollar state');
    }
    // Validate run consistency
    if (dollar.gamesInThisRun < 0) {
        errors.push('Games in this run cannot be negative');
    }
    if (dollar.currentRunWinnings < 0) {
        errors.push('Current run winnings cannot be negative');
    }
    if (!dollar.runId || dollar.runId.trim() === '') {
        errors.push('Run ID is required for independent runs');
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
export function validateSimulationParameters(params) {
    const errors = [];
    const warnings = [];
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
export function generateSerialNumber() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const firstLetter = letters[Math.floor(Math.random() * letters.length)];
    const lastLetter = letters[Math.floor(Math.random() * letters.length)];
    const digits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `${firstLetter}${digits}${lastLetter}`;
}
/**
 * Calculate betting level value in dollars (exponential: 2^(level-1))
 */
export function getBettingLevelValue(level) {
    return Math.pow(2, level - 1);
}
/**
 * Calculate winning amount for a betting level (double the bet)
 */
export function getBettingLevelWinnings(level) {
    return getBettingLevelValue(level) * 2;
}
/**
 * Check if a betting level is valid
 */
export function isValidBettingLevel(level) {
    return level >= 1 && level <= 10 && Number.isInteger(level);
}
/**
 * Create an empty revenue stream
 */
export function createEmptyRevenueStream() {
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
export function createDefaultSimulationParameters() {
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
//# sourceMappingURL=virtual-dollar-engine.js.map