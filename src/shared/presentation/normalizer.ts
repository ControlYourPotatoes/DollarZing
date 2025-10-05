import {
  NormalizedDistributionPoint,
  NormalizedPresentationScenario,
  NormalizedPresentationDay,
  PresentationSnapshotFile,
  EngineDailyResult,
  EngineDailySnapshot,
  EngineDailySnapshotLevel,
  CohortAnalyticsPoint,
  FlowAnalyticsPoint,
  GamesAnalyticsPoint,
  LevelAnalyticsPoint,
  LevelAnalyticsStep,
} from "./types";

import { validatePresentationSnapshotFile } from "./validation";

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildDistributionSeries(points: NormalizedDistributionPoint[]): {
  series: NormalizedDistributionPoint[];
  total: number;
} {
  const total = points.reduce((sum, point) => sum + point.value, 0);

  const series = points.map((point) => ({
    ...point,
    percentage: total > 0 ? roundToTwoDecimals(point.value / total) : 0,
  }));

  return {
    series,
    total: roundToTwoDecimals(total),
  };
}

export function normalizePresentationSnapshot(
  raw: unknown
): NormalizedPresentationScenario {
  const snapshotFile = validatePresentationSnapshotFile(raw);

  const datasetByDay = indexEngineDataset(snapshotFile.engineDataset);
  const dailyByDay = indexDailySnapshots(snapshotFile.engineDailySnapshots);

  const cohortAnalytics: CohortAnalyticsPoint[] = [];
  const flowAnalytics: FlowAnalyticsPoint[] = [];
  const gamesAnalytics: GamesAnalyticsPoint[] = [];
  const levelAnalytics: LevelAnalyticsPoint[] = [];

  const days: NormalizedPresentationDay[] = snapshotFile.days.map((day) => {
    const distributionPoints = day.charts.distributionSeries.map((point) => ({
      ...point,
      percentage: 0,
    }));

    const accumulationSeries = day.charts.accumulationSeries.map((point) => ({
      ...point,
    }));

    const { series, total } = buildDistributionSeries(distributionPoints);

    const accumulationMap = accumulationSeries.reduce<Record<string, number>>(
      (acc, point) => {
        acc[point.metric] = roundToTwoDecimals(point.cumulative);
        return acc;
      },
      {}
    );

    const datasetEntry = datasetByDay.get(day.dayIndex + 1);
    const dailyEntry = dailyByDay.get(day.dayIndex + 1);
    const label = day.timelineTick.label ?? `Day ${day.dayIndex + 1}`;

    const totalPlayers = ensureNumber(
      datasetEntry?.playerStatistics?.totalPlayers ??
        dailyEntry?.totals?.totalPlayers ??
        day.timelineTick.cumulativePlayers
    );
    const activePlayers = ensureNumber(
      datasetEntry?.playerStatistics?.activePlayers ??
        dailyEntry?.totals?.activePlayers ??
        totalPlayers
    );
    const survivalRate =
      totalPlayers > 0 ? (activePlayers / totalPlayers) * 100 : 0;

    const cumulativeRevenue = ensureNumber(day.timelineTick.cumulativeRevenue);
    const cumulativePayouts = ensureNumber(day.timelineTick.cumulativePayouts);
    const netValue = cumulativeRevenue - cumulativePayouts;

    cohortAnalytics.push({
      dayIndex: day.dayIndex,
      label,
      totalPlayers,
      activePlayers,
      survivalRate,
      cumulativeRevenue,
      cumulativePayouts,
      netValue,
    });

    flowAnalytics.push({
      dayIndex: day.dayIndex,
      label,
      cumulativeRevenue,
      cumulativePlatformFees: ensureNumber(
        day.timelineTick.cumulativeFees ??
          datasetEntry?.revenueStatistics?.totalPlatformRevenue ??
          dailyEntry?.timelineTicks?.[0]?.cumulativePlatformFees
      ),
      cumulativeCharity: ensureNumber(
        day.timelineTick.cumulativeCharity ??
          datasetEntry?.revenueStatistics?.totalCharityContributions ??
          dailyEntry?.timelineTicks?.[0]?.cumulativeCharity
      ),
      cumulativePayouts,
    });

    gamesAnalytics.push({
      dayIndex: day.dayIndex,
      label,
      totalGames: ensureNumber(
        dailyEntry?.totals?.gamesPlayed ??
          datasetEntry?.gameStatistics?.totalGames
      ),
      newPlayers: ensureNumber(
        datasetEntry?.newPlayers ?? dailyEntry?.totals?.newPlayers
      ),
    });

    const levelSteps = buildLevelSteps(
      dailyEntry?.levels,
      datasetEntry?.gameStatistics?.totalGames,
      datasetEntry?.playerStatistics?.totalPlayers
    );
    levelAnalytics.push({
      dayIndex: day.dayIndex,
      label,
      steps: levelSteps,
    });

    return {
      dayIndex: day.dayIndex,
      date: day.date,
      label,
      summary: day.summary,
      timelineTick: day.timelineTick,
      financialWorkflow: day.financialWorkflow,
      charts: {
        distributionSeries: series,
        distributionTotal: total,
        accumulationSeries,
        accumulationMap,
      },
      ...(day.pool ? { pool: { ...day.pool } } : {}),
      ...(day.cashouts ? { cashouts: { ...day.cashouts } } : {}),
    };
  });

  // Accumulate charity and payouts from daily snapshots
  let cumulativeCharity = 0;
  let cumulativePayouts = 0;
  days.forEach((day) => {
    const dailyEntry = dailyByDay.get(day.dayIndex + 1);
    if (dailyEntry) {
      cumulativeCharity += dailyEntry.totals?.charity || 0;
      cumulativePayouts += dailyEntry.totals?.playerPayouts || 0;
    }
    day.timelineTick.cumulativeCharity = cumulativeCharity;
    day.timelineTick.cumulativePayouts = cumulativePayouts;
  });

  const dayLookup = days.reduce<Record<number, NormalizedPresentationDay>>(
    (lookup, day) => {
      lookup[day.dayIndex] = day;
      return lookup;
    },
    {}
  );

  const timelineSeries = days.reduce(
    (acc, day) => {
      acc.revenue.push(roundToTwoDecimals(day.timelineTick.cumulativeRevenue));
      acc.charity.push(roundToTwoDecimals(day.timelineTick.cumulativeCharity));
      acc.fees.push(roundToTwoDecimals(day.timelineTick.cumulativeFees));
      acc.payouts.push(roundToTwoDecimals(day.timelineTick.cumulativePayouts));
      acc.players.push(day.timelineTick.cumulativePlayers);
      return acc;
    },
    {
      revenue: [] as number[],
      charity: [] as number[],
      fees: [] as number[],
      payouts: [] as number[],
      players: [] as number[],
    }
  );

  // Build summary object for UI convenience
  const summary = {
    daysCount: days.length,
    firstDate: days.length > 0 ? days[0].date : undefined,
    lastDate: days.length > 0 ? days[days.length - 1].date : undefined,
    totalRevenue: roundToTwoDecimals(snapshotFile.totals.cumulativeRevenue),
    totalCharity: roundToTwoDecimals(snapshotFile.totals.cumulativeCharity),
    totalFees: roundToTwoDecimals(snapshotFile.totals.cumulativeFees),
    totalPayouts: roundToTwoDecimals(snapshotFile.totals.cumulativePayouts),
    maxPlayers: Math.max(...timelineSeries.players),
  };

  return {
    scenarioId: snapshotFile.scenarioId,
    parameters: snapshotFile.parameters,
    coordinates: snapshotFile.coordinates,
    totals: snapshotFile.totals,
    generatedAt: snapshotFile.generatedAt,
    duration: days.length,
    days,
    dayLookup,
    timelineSeries,
    summary,
    analytics: {
      cohort: cohortAnalytics,
      flow: flowAnalytics,
      games: gamesAnalytics,
      levels: levelAnalytics,
    },
  };
}

export function assertSnapshotMatchesScenario(
  snapshot: PresentationSnapshotFile,
  scenarioId: string
): void {
  if (snapshot.scenarioId !== scenarioId) {
    throw new Error(
      `Snapshot scenario mismatch: expected ${scenarioId}, received ${snapshot.scenarioId}`
    );
  }
}

function indexEngineDataset(
  dataset?: PresentationSnapshotFile["engineDataset"]
): Map<number, EngineDailyResult> {
  const map = new Map<number, EngineDailyResult>();
  if (!dataset?.dailyResults) return map;
  dataset.dailyResults.forEach((entry) => {
    if (!entry || !Number.isFinite(entry.day)) return;
    map.set(entry.day, entry);
  });
  return map;
}

function indexDailySnapshots(
  snapshots?: PresentationSnapshotFile["engineDailySnapshots"]
): Map<number, EngineDailySnapshot> {
  const map = new Map<number, EngineDailySnapshot>();
  if (!Array.isArray(snapshots)) return map;
  snapshots.forEach((entry) => {
    if (!entry || !Number.isFinite(entry.day)) return;
    map.set(entry.day, entry);
  });
  return map;
}

function ensureNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function buildLevelSteps(
  levels: EngineDailySnapshotLevel[] | undefined,
  totalGames?: number,
  totalPlayers?: number
): LevelAnalyticsStep[] {
  if (!Array.isArray(levels) || levels.length === 0) {
    return [];
  }

  const baseGames = ensureNumber(totalGames);
  const basePlayers = ensureNumber(totalPlayers);
  const level1Games = ensureNumber(levels[0]?.gamesPlayed ?? baseGames);

  return levels.map((level) => {
    const gamesPlayed = ensureNumber(level.gamesPlayed);
    const wins = ensureNumber(level.wins);
    const cashouts = ensureNumber(level.cashouts);
    const progressions = ensureNumber(level.progressions);
    const winnings = ensureNumber(level.winnings);
    const losses = ensureNumber(level.losses);

    const survivalRate =
      level1Games > 0 ? (gamesPlayed / level1Games) * 100 : 0;
    const retentionRate =
      basePlayers > 0 ? (gamesPlayed / basePlayers) * 100 : 0;

    return {
      level: level.level,
      gamesPlayed,
      wins,
      cashouts,
      progressions,
      winnings,
      losses,
      survivalRate,
      retentionRate,
    };
  });
}
