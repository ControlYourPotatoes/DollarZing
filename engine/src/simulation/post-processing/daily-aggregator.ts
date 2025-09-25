import type { SimulationResults } from "../game-engine-simulator";

export interface WorkflowLayerBreakdown {
  id: string;
  label: string;
  amount: number;
  percentage: number;
}

export interface WorkflowNode {
  id: string;
  label: string;
  category: "platform" | "charity" | "players";
  amount: number;
  cumulativeAmount: number;
  percentageOfTotal: number;
  layers: WorkflowLayerBreakdown[];
}

export interface TimelineTick {
  id: string;
  label: string;
  day: number;
  cumulativePlatformFees: number;
  cumulativeCharity: number;
  cumulativePlayerPayouts: number;
  cumulativeRevenue: number;
  dailyPlatformFees: number;
  dailyCharity: number;
  dailyPlayerPayouts: number;
  dailyRevenue: number;
}

export interface ChartSeriesPoint {
  day: number;
  dailyValue: number;
  cumulativeValue: number;
}

export interface LevelBreakdown {
  level: number;
  gamesPlayed: number;
  wins: number;
  cashouts: number;
  progressions: number;
  winnings: number;
  losses: number;
}

export interface RunLifecycle {
  runsStarted: number;
  runsCompleted: number;
  runsCashedOut: number;
  runsFailed: number;
  levelDistribution: number[]; // Array of 10 numbers, index 0 = level 1, index 9 = level 10
}

export interface DailyAggregateSnapshot {
  day: number;
  date: string;
  totals: {
    revenue: number;
    platformFees: number;
    charity: number;
    playerPayouts: number;
    gamesPlayed: number;
    activePlayers: number;
    totalPlayers: number;
    newPlayers: number;
  };
  pool?: {
    depositedToday: number; // runs created today
    consumedToday: number; // games played today * 2 dollars
    outstanding: number; // dollars currently in pool
  };
  cashouts?: {
    countToday: number;
    amountToday: number;
    cumulativeAmount: number;
    cumulativeCount: number;
  };
  levels?: LevelBreakdown[]; // Array of 10 items (level 1-10)
  lifecycle?: RunLifecycle;
  workflowNodes: WorkflowNode[];
  timelineTicks: TimelineTick[];
  charts: {
    platformFees: ChartSeriesPoint;
    charity: ChartSeriesPoint;
    playerPayouts: ChartSeriesPoint;
    totalRevenue: ChartSeriesPoint;
  };
}

interface RevenueAccumulator {
  platformFees: number;
  charity: number;
  playerPayouts: number;
  games: number;
  runs: number;
  cashoutsAmount: number;
  cashoutsCount: number;
}

interface LevelAccumulator {
  level: number;
  gamesPlayed: number;
  wins: number;
  cashouts: number;
  progressions: number;
  winnings: number;
  losses: number;
}

interface LifecycleAccumulator {
  runsStarted: number;
  runsCompleted: number;
  runsCashedOut: number;
  runsFailed: number;
  levelDistribution: number[]; // Array of 10 numbers for levels 1-10
}

const BASE_SNAPSHOT_DATE = Date.UTC(2025, 0, 1);

export function generateDailyAggregates(
  results: SimulationResults
): DailyAggregateSnapshot[] {
  const aggregates: DailyAggregateSnapshot[] = [];
  const accumulator: RevenueAccumulator = {
    platformFees: 0,
    charity: 0,
    playerPayouts: 0,
    games: 0,
    runs: 0,
    cashoutsAmount: 0,
    cashoutsCount: 0,
  };

  // Initialize level accumulators for all 10 levels
  const levelAccumulators: LevelAccumulator[] = Array.from(
    { length: 10 },
    (_, i) => ({
      level: i + 1,
      gamesPlayed: 0,
      wins: 0,
      cashouts: 0,
      progressions: 0,
      winnings: 0,
      losses: 0,
    })
  );

  const lifecycleAccumulator: LifecycleAccumulator = {
    runsStarted: 0,
    runsCompleted: 0,
    runsCashedOut: 0,
    runsFailed: 0,
    levelDistribution: Array(10).fill(0),
  };

  if (!results.dailyResults || results.dailyResults.length === 0) {
    return aggregates;
  }

  for (const dailyResult of results.dailyResults) {
    const dayIndex = dailyResult.day ?? aggregates.length + 1;
    const revenueStats = dailyResult.revenueStatistics;
    const gameStats = dailyResult.gameStatistics;

    const cumulativePlatform = revenueStats
      ? revenueStats.totalPlatformRevenue
      : accumulator.platformFees;
    const cumulativeCharity = revenueStats
      ? revenueStats.totalCharityContributions
      : accumulator.charity;
    const cumulativePayouts = revenueStats
      ? revenueStats.totalPlayerPayouts
      : accumulator.playerPayouts;
    const cumulativeGames = gameStats
      ? gameStats.totalGames
      : accumulator.games;

    const dailyPlatformFees = clampToZero(
      cumulativePlatform - accumulator.platformFees
    );
    const dailyCharity = clampToZero(cumulativeCharity - accumulator.charity);
    const dailyPayouts = clampToZero(
      cumulativePayouts - accumulator.playerPayouts
    );
    const dailyRevenue = dailyPlatformFees + dailyCharity + dailyPayouts;
    const dailyGames = clampToZero(cumulativeGames - accumulator.games);
    const cumulativeRuns =
      (gameStats && (gameStats.totalRunsCreated ?? 0)) || 0;
    const dailyRuns = clampToZero(cumulativeRuns - accumulator.runs);

    const cumulativeCashoutsAmount = revenueStats
      ? revenueStats.totalCashOuts ?? 0
      : accumulator.cashoutsAmount;
    const cumulativeCashoutsCount = revenueStats
      ? revenueStats.cashOutCount ?? 0
      : accumulator.cashoutsCount;
    const dailyCashoutsAmount = clampToZero(
      cumulativeCashoutsAmount - accumulator.cashoutsAmount
    );
    const dailyCashoutsCount = clampToZero(
      cumulativeCashoutsCount - accumulator.cashoutsCount
    );

    const cumulativeRevenue =
      cumulativePlatform + cumulativeCharity + cumulativePayouts;

    const totals = {
      revenue: roundToCents(dailyRevenue),
      platformFees: roundToCents(dailyPlatformFees),
      charity: roundToCents(dailyCharity),
      playerPayouts: roundToCents(dailyPayouts),
      gamesPlayed: dailyGames,
      activePlayers: dailyResult.playerStatistics?.activePlayers ?? 0,
      totalPlayers: dailyResult.playerStatistics?.totalPlayers ?? 0,
      newPlayers: dailyResult.newPlayers ?? 0,
    };

    const workflowNodes = buildWorkflowNodes(
      totals.revenue,
      dailyPlatformFees,
      dailyCharity,
      dailyPayouts,
      cumulativePlatform,
      cumulativeCharity,
      cumulativePayouts
    );

    const timelineTick = buildTimelineTick({
      dayIndex,
      dailyPlatformFees,
      dailyCharity,
      dailyPayouts,
      dailyRevenue,
      cumulativePlatform,
      cumulativeCharity,
      cumulativePayouts,
      cumulativeRevenue,
    });

    const charts = buildChartSeriesPoints({
      dayIndex,
      dailyPlatformFees,
      dailyCharity,
      dailyPayouts,
      dailyRevenue,
      cumulativePlatform,
      cumulativeCharity,
      cumulativePayouts,
      cumulativeRevenue,
    });

    // Generate level breakdown for this day
    const levelBreakdown = generateLevelBreakdown(
      levelAccumulators,
      dailyResult
    );

    // Generate lifecycle data for this day
    const lifecycle = generateLifecycleData(lifecycleAccumulator, dailyResult);

    aggregates.push({
      day: dayIndex,
      date: buildSnapshotDate(dayIndex),
      totals,
      pool: {
        depositedToday: dailyRuns,
        consumedToday: dailyGames * 2,
        outstanding: gameStats?.pooledVirtualDollars ?? 0,
      },
      cashouts: {
        countToday: dailyCashoutsCount,
        amountToday: roundToCents(dailyCashoutsAmount),
        cumulativeAmount: roundToCents(cumulativeCashoutsAmount),
        cumulativeCount: cumulativeCashoutsCount,
      },
      levels: levelBreakdown,
      lifecycle: lifecycle,
      workflowNodes,
      timelineTicks: [timelineTick],
      charts,
    });

    accumulator.platformFees = cumulativePlatform;
    accumulator.charity = cumulativeCharity;
    accumulator.playerPayouts = cumulativePayouts;
    accumulator.games = cumulativeGames;
    accumulator.runs = cumulativeRuns;
    accumulator.cashoutsAmount = cumulativeCashoutsAmount;
    accumulator.cashoutsCount = cumulativeCashoutsCount;
  }

  return aggregates;
}

function buildSnapshotDate(dayIndex: number): string {
  const date = new Date(BASE_SNAPSHOT_DATE);
  date.setUTCDate(date.getUTCDate() + (dayIndex - 1));
  return date.toISOString();
}

function buildWorkflowNodes(
  dailyRevenue: number,
  dailyPlatformFees: number,
  dailyCharity: number,
  dailyPayouts: number,
  cumulativePlatform: number,
  cumulativeCharity: number,
  cumulativePayouts: number
): WorkflowNode[] {
  const total = dailyRevenue > 0 ? dailyRevenue : 1;
  return [
    {
      id: "platform",
      label: "Platform Fees",
      category: "platform",
      amount: roundToCents(dailyPlatformFees),
      cumulativeAmount: roundToCents(cumulativePlatform),
      percentageOfTotal: roundToPercentage(dailyPlatformFees / total),
      layers: [
        {
          id: "fees",
          label: "Click Fees",
          amount: roundToCents(dailyPlatformFees),
          percentage: roundToPercentage(dailyPlatformFees / total),
        },
      ],
    },
    {
      id: "charity",
      label: "Charity",
      category: "charity",
      amount: roundToCents(dailyCharity),
      cumulativeAmount: roundToCents(cumulativeCharity),
      percentageOfTotal: roundToPercentage(dailyCharity / total),
      layers: [
        {
          id: "donations",
          label: "Donations",
          amount: roundToCents(dailyCharity),
          percentage: roundToPercentage(dailyCharity / total),
        },
      ],
    },
    {
      id: "players",
      label: "Player Payouts",
      category: "players",
      amount: roundToCents(dailyPayouts),
      cumulativeAmount: roundToCents(cumulativePayouts),
      percentageOfTotal: roundToPercentage(dailyPayouts / total),
      layers: [
        {
          id: "winnings",
          label: "Winnings",
          amount: roundToCents(dailyPayouts),
          percentage: roundToPercentage(dailyPayouts / total),
        },
      ],
    },
  ];
}

function buildTimelineTick(config: {
  dayIndex: number;
  dailyPlatformFees: number;
  dailyCharity: number;
  dailyPayouts: number;
  dailyRevenue: number;
  cumulativePlatform: number;
  cumulativeCharity: number;
  cumulativePayouts: number;
  cumulativeRevenue: number;
}): TimelineTick {
  const label = `Day ${config.dayIndex}`;
  return {
    id: `day-${config.dayIndex}`,
    label,
    day: config.dayIndex,
    cumulativePlatformFees: roundToCents(config.cumulativePlatform),
    cumulativeCharity: roundToCents(config.cumulativeCharity),
    cumulativePlayerPayouts: roundToCents(config.cumulativePayouts),
    cumulativeRevenue: roundToCents(config.cumulativeRevenue),
    dailyPlatformFees: roundToCents(config.dailyPlatformFees),
    dailyCharity: roundToCents(config.dailyCharity),
    dailyPlayerPayouts: roundToCents(config.dailyPayouts),
    dailyRevenue: roundToCents(config.dailyRevenue),
  };
}

function buildChartSeriesPoints(config: {
  dayIndex: number;
  dailyPlatformFees: number;
  dailyCharity: number;
  dailyPayouts: number;
  dailyRevenue: number;
  cumulativePlatform: number;
  cumulativeCharity: number;
  cumulativePayouts: number;
  cumulativeRevenue: number;
}): DailyAggregateSnapshot["charts"] {
  return {
    platformFees: {
      day: config.dayIndex,
      dailyValue: roundToCents(config.dailyPlatformFees),
      cumulativeValue: roundToCents(config.cumulativePlatform),
    },
    charity: {
      day: config.dayIndex,
      dailyValue: roundToCents(config.dailyCharity),
      cumulativeValue: roundToCents(config.cumulativeCharity),
    },
    playerPayouts: {
      day: config.dayIndex,
      dailyValue: roundToCents(config.dailyPayouts),
      cumulativeValue: roundToCents(config.cumulativePayouts),
    },
    totalRevenue: {
      day: config.dayIndex,
      dailyValue: roundToCents(config.dailyRevenue),
      cumulativeValue: roundToCents(config.cumulativeRevenue),
    },
  };
}

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundToPercentage(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 10;
}

function clampToZero(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
}

function generateLevelBreakdown(
  levelAccumulators: LevelAccumulator[],
  dailyResult: any
): LevelBreakdown[] {
  // This function processes level data from the simulation results
  // Currently returns placeholder data - will be enhanced when simulation provides level data

  const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

  return levelAccumulators.map((acc, index) => {
    const levelValue = LEVELS[index];
    const totalGames = dailyResult.gameStatistics?.totalGames || 0;

    // Placeholder logic - in real implementation, this would come from simulation
    // For now, distribute games across levels with decreasing frequency
    const gamesAtLevel = Math.floor(totalGames / Math.pow(2, index));
    const wins = Math.floor(gamesAtLevel / 2);
    const cashouts = Math.floor(wins * (0.1 + index * 0.05)); // Increasing cashout rate
    const progressions = wins - cashouts;

    return {
      level: acc.level,
      gamesPlayed: gamesAtLevel,
      wins: wins,
      cashouts: cashouts,
      progressions: progressions,
      winnings: cashouts * levelValue * 1.8, // Match existing winnings structure
      losses: gamesAtLevel - wins, // Per-level losses, not cumulative
    };
  });
}

function generateLifecycleData(
  _lifecycleAccumulator: LifecycleAccumulator,
  dailyResult: any
): RunLifecycle {
  // This function processes run lifecycle data from the simulation results
  // Currently returns placeholder data - will be enhanced when simulation provides lifecycle data

  const gameStats = dailyResult.gameStatistics || {};

  // Placeholder logic - in real implementation, this would come from simulation
  const runsStarted = gameStats.totalRunsCreated || 0;
  const runsCompleted = gameStats.jackpotsWon || 0;
  const runsCashedOut = Math.floor(runsStarted * 0.3); // 30% cashout rate
  const runsFailed = runsStarted - runsCompleted - runsCashedOut;

  // Distribute runs across levels (more at lower levels)
  const levelDistribution = Array.from({ length: 10 }, (_, i) =>
    Math.floor(runsStarted / Math.pow(2, i + 1))
  );

  return {
    runsStarted: runsStarted,
    runsCompleted: runsCompleted,
    runsCashedOut: runsCashedOut,
    runsFailed: runsFailed,
    levelDistribution: levelDistribution,
  };
}
