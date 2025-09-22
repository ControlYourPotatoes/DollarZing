import {
  NormalizedDistributionPoint,
  NormalizedPresentationScenario,
  NormalizedPresentationDay,
  PresentationSnapshotFile,
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

    return {
      dayIndex: day.dayIndex,
      date: day.date,
      label: day.timelineTick.label,
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
