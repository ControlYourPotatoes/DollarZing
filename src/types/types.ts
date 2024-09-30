export type CashOutStrategy = 'low' | 'average' | 'high';

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
  currentDayLevelData: LevelData[]
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