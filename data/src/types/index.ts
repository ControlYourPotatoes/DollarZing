// Enhanced Data Structures for DollarZing Simulation Engine
// Supports daily, weekly, monthly, yearly aggregations with player journey tracking

export type CashOutStrategy = 'low' | 'average' | 'high';
export type FlowType = 'cashout' | 'loss' | 'jackpot' | 'entry';
export type PlayerExperience = 'beginner' | 'intermediate' | 'advanced';

// Core simulation parameters
export interface SimulationParameters {
  cashOutStrategy: CashOutStrategy;
  adoptionRate: number;
  growthMultiplier: number;
  panamaAdoption: boolean;
}

// Performance and generation metadata
export interface DatasetMetadata {
  generationDurationMs: number;
  dataPoints: number;
  memoryUsageMB: number;
  accuracy: number;
}

// Player metrics for daily tracking
export interface PlayerMetrics {
  totalPlayers: number;
  activePlayers: number;
  newPlayers: number;
  churnedPlayers: number;
  retentionRate: number;
}

// Financial metrics for daily tracking
export interface FinancialMetrics {
  totalRevenue: number;
  platformEarnings: number;
  charityContributions: number;
  governmentEarnings: number;
  playerWinnings: number;
  gamesPlayed: number;
}

// Revenue distribution breakdown
export interface RevenueBreakdown {
  platform: { amount: number; percentage: number };
  charity: { amount: number; percentage: number };
  government: { amount: number; percentage: number };
  players: { amount: number; percentage: number };
}

// Level-specific statistics and analytics
export interface LevelStatistics {
  level: number;
  gamesAtLevel: number;
  successRate: number;
  avgTimeAtLevel: number;
  bottleneckScore: number;
}

// Player distribution across experience levels
export interface PlayerDistribution {
  newPlayers: number;
  returningPlayers: number;
  advancedPlayers: number;
}

// Cash-out pattern analysis by strategy
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

// Financial impact analysis for levels
export interface FinancialImpact {
  totalRevenue: number;
  platformShare: number;
  charityShare: number;
  governmentShare: number;
  playerShare: number;
}

// Enhanced level progression data with comprehensive analytics
export interface LevelProgressionData extends LevelStatistics {
  playerDistribution: PlayerDistribution;
  cashOutPatterns: CashOutPatterns;
  financialImpact: FinancialImpact;
}

// Individual player progression through levels
export interface PlayerLevelProgression {
  level: number;
  gamesAtLevel: number;
  timeSpentMinutes: number;
}

// Cash-out event tracking
export interface CashOutEvent {
  day: number;
  level: number;
  amount: number;
  strategy: CashOutStrategy;
}

// Complete player journey tracking
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

// Daily snapshot with comprehensive metrics
export interface DailySnapshot {
  day: number;
  date: Date;
  playerMetrics: PlayerMetrics;
  financialMetrics: FinancialMetrics;
  levelProgression: LevelStatistics[];
  playerJourneys: PlayerJourney[];
}

// Weekly aggregation data
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

// Monthly aggregation data
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

// Yearly aggregation data
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

// Time-based aggregations
export interface DatasetAggregations {
  weekly: WeeklySnapshot[];
  monthly: MonthlySnapshot[];
  yearly: YearlySnapshot | null;
}

// Detailed financial flow record for revenue tracking
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

// Main dataset container with metadata and versioning
export interface SimulationDataset {
  id: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  parameters: SimulationParameters;
  metadata: DatasetMetadata;
  dailySnapshots: DailySnapshot[];
  aggregations: DatasetAggregations;
  financialFlows?: FinancialFlowRecord[]; // Optional detailed financial tracking
}

// Legacy compatibility types (from existing codebase)
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
  [key: string]: number; // For level data
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

// Utility types for data validation and processing
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

// Performance monitoring types
export type PerformanceMetrics = {
  generationTime: number;
  memoryUsage: number;
  serializationTime: number;
  deserializationTime: number;
};