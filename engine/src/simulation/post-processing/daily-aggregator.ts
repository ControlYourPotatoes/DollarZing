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
  };
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
    const cumulativeGames = gameStats ? gameStats.totalGames : accumulator.games;

    const dailyPlatformFees = clampToZero(
      cumulativePlatform - accumulator.platformFees
    );
    const dailyCharity = clampToZero(cumulativeCharity - accumulator.charity);
    const dailyPayouts = clampToZero(
      cumulativePayouts - accumulator.playerPayouts
    );
    const dailyRevenue = dailyPlatformFees + dailyCharity + dailyPayouts;
    const dailyGames = clampToZero(cumulativeGames - accumulator.games);

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

    aggregates.push({
      day: dayIndex,
      date: buildSnapshotDate(dayIndex),
      totals,
      workflowNodes,
      timelineTicks: [timelineTick],
      charts,
    });

    accumulator.platformFees = cumulativePlatform;
    accumulator.charity = cumulativeCharity;
    accumulator.playerPayouts = cumulativePayouts;
    accumulator.games = cumulativeGames;
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
