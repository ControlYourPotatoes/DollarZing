export type CashOutStrategy = 'low' | 'average' | 'high';
export type FlowType = 'cashout' | 'loss' | 'jackpot' | 'entry';
export type PlayerExperience = 'beginner' | 'intermediate' | 'advanced';
export interface SimulationParameters {
    cashOutStrategy: CashOutStrategy;
    adoptionRate: number;
    growthMultiplier: number;
    panamaAdoption: boolean;
}
export interface DatasetMetadata {
    generationDurationMs: number;
    dataPoints: number;
    memoryUsageMB: number;
    accuracy: number;
}
export interface PlayerMetrics {
    totalPlayers: number;
    activePlayers: number;
    newPlayers: number;
    churnedPlayers: number;
    retentionRate: number;
}
export interface FinancialMetrics {
    totalRevenue: number;
    platformEarnings: number;
    charityContributions: number;
    governmentEarnings: number;
    playerWinnings: number;
    gamesPlayed: number;
}
export interface RevenueBreakdown {
    platform: {
        amount: number;
        percentage: number;
    };
    charity: {
        amount: number;
        percentage: number;
    };
    government: {
        amount: number;
        percentage: number;
    };
    players: {
        amount: number;
        percentage: number;
    };
}
export interface LevelStatistics {
    level: number;
    gamesAtLevel: number;
    successRate: number;
    avgTimeAtLevel: number;
    bottleneckScore: number;
}
export interface PlayerDistribution {
    newPlayers: number;
    returningPlayers: number;
    advancedPlayers: number;
}
export interface CashOutPattern {
    count: number;
    avgAmount: number;
    successRate: number;
}
export interface CashOutPatterns {
    low: CashOutPattern;
    average: CashOutPattern;
    high: CashOutPattern;
}
export interface FinancialImpact {
    totalRevenue: number;
    platformShare: number;
    charityShare: number;
    governmentShare: number;
    playerShare: number;
}
export interface LevelProgressionData extends LevelStatistics {
    playerDistribution: PlayerDistribution;
    cashOutPatterns: CashOutPatterns;
    financialImpact: FinancialImpact;
}
export interface PlayerLevelProgression {
    level: number;
    gamesAtLevel: number;
    timeSpentMinutes: number;
}
export interface CashOutEvent {
    day: number;
    level: number;
    amount: number;
    strategy: CashOutStrategy;
}
export interface PlayerJourney {
    playerId: string;
    startDate: Date;
    endDate: Date;
    totalGamesPlayed: number;
    maxLevelReached: number;
    totalWinnings: number;
    totalLosses: number;
    netGain: number;
    cashOutEvents: CashOutEvent[];
    levelProgression: PlayerLevelProgression[];
}
export interface DailySnapshot {
    day: number;
    date: Date;
    playerMetrics: PlayerMetrics;
    financialMetrics: FinancialMetrics;
    levelProgression: LevelStatistics[];
    playerJourneys: PlayerJourney[];
}
export interface WeeklySnapshot {
    week: number;
    startDate: Date;
    endDate: Date;
    aggregatedPlayerMetrics: PlayerMetrics;
    aggregatedFinancialMetrics: FinancialMetrics;
    weeklyGrowthRate: number;
    averageDailyGames: number;
    retentionTrend: number;
}
export interface MonthlySnapshot {
    month: number;
    startDate: Date;
    endDate: Date;
    aggregatedPlayerMetrics: PlayerMetrics;
    aggregatedFinancialMetrics: FinancialMetrics;
    monthlyGrowthRate: number;
    seasonalFactors: number;
    churnAnalysis: {
        totalChurned: number;
        churnRate: number;
        averageTenure: number;
    };
}
export interface YearlySnapshot {
    year: number;
    aggregatedPlayerMetrics: PlayerMetrics;
    aggregatedFinancialMetrics: FinancialMetrics;
    annualGrowthRate: number;
    totalDataPoints: number;
    performanceMetrics: {
        peakDay: number;
        peakPlayers: number;
        peakRevenue: number;
        averageDaily: {
            players: number;
            revenue: number;
            games: number;
        };
    };
}
export interface DatasetAggregations {
    weekly: WeeklySnapshot[];
    monthly: MonthlySnapshot[];
    yearly: YearlySnapshot | null;
}
export interface FinancialFlowRecord {
    timestamp: Date;
    transactionId: string;
    level: number;
    playerCount: number;
    baseAmount: number;
    revenueBreakdown: RevenueBreakdown;
    flowType: FlowType;
    metadata: {
        cashOutStrategy: CashOutStrategy;
        playerExperience: PlayerExperience;
        timeAtLevel: number;
    };
}
export interface SimulationDataset {
    id: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    parameters: SimulationParameters;
    metadata: DatasetMetadata;
    dailySnapshots: DailySnapshot[];
    aggregations: DatasetAggregations;
    financialFlows?: FinancialFlowRecord[];
}
export interface ChartDataPoint {
    day: number;
    charityContributions: number;
    platformEarnings: number;
    jackpotWinners: number;
    gamesPlayed: number;
    totalPlayers: number;
    activePlayers: number;
    governmentEarnings: number;
    outreachPot: number;
    playerWinnings: number;
    [key: string]: number;
}
export interface WeeklyStats {
    week: number;
    totalCharity: number;
    totalPlatformEarnings: number;
    totalJackpotWinners: number;
    totalGamesPlayed: number;
    activePlayersGrowth: number;
    averageDailyGames: number;
}
export interface GameState {
    day: number;
    totalCharity: number;
    chartData: ChartDataPoint[];
    jackpotWinners: number;
    totalGamesPlayed: number;
    platformEarnings: number;
    governmentEarnings: number;
    outreachPot: number;
    totalWinnings: number;
    totalPlayers: number;
    activePlayers: number;
    weeklyStats: WeeklyStats[];
    currentDayLevelData: LevelData[];
}
export interface SimulationProps {
    cashOutStrategy: CashOutStrategy;
    adoptionRate: number;
}
export interface LevelData {
    level: number;
    gamesAtLevel: number;
    cashOutProbability: number;
    cashOutPlayers: number;
    losingPlayers: number;
    platformEarnings: number;
    charityContribution: number;
    governmentEarnings: number;
    playerWinnings: number;
    dailyJackpotWinners: number;
}
export interface BillsPerDayRange {
    min: number;
    max: number;
}
export type DatasetValidationResult = {
    isValid: boolean;
    errors: string[];
    warnings: string[];
};
export type SerializationOptions = {
    includePlayerJourneys: boolean;
    includeFinancialFlows: boolean;
    compressionLevel: 'none' | 'standard' | 'high';
};
export type PerformanceMetrics = {
    generationTime: number;
    memoryUsage: number;
    serializationTime: number;
    deserializationTime: number;
};
//# sourceMappingURL=index.d.ts.map