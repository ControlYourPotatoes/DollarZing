// Engine-specific types for simulation (no cross-imports, no government)

export type CashOutStrategy = 'low' | 'average' | 'high';
export type FlowType = 'cashout' | 'loss' | 'jackpot' | 'entry';

// Core simulation parameters
export interface SimulationParameters {
  cashOutStrategy: CashOutStrategy;
  adoptionRate: number;
  growthMultiplier: number;
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

// Financial metrics for daily tracking (no government)
export interface FinancialMetrics {
  totalRevenue: number;
  platformEarnings: number;
  charityContributions: number;
  playerWinnings: number;
  gamesPlayed: number;
}

// Revenue distribution breakdown (no government)
export interface RevenueBreakdown {
  platform: { amount: number; percentage: number };
  charity: { amount: number; percentage: number };
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
}

// Utility types for data validation
export type DatasetValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};