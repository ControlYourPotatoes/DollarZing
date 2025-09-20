import type { DailyAggregateSnapshot } from "./daily-aggregator";

export interface PresentationScenarioParameters {
  adoptionRate: string;
  cashOutStrategy: string;
  charityShare: string;
}

export interface PresentationScenarioCoordinates {
  adoptionRate: number;
  cashOutStrategy: number;
  charityShare: number;
}

export interface PresentationSnapshotFile {
  scenarioId: string;
  generatedAt: string;
  parameters: PresentationScenarioParameters;
  coordinates: PresentationScenarioCoordinates;
  totals: {
    players: number;
    activePlayers: number;
    cumulativeRevenue: number;
    cumulativeCharity: number;
    cumulativeFees: number;
    cumulativePayouts: number;
  };
  days: PresentationSnapshot[];
}

export interface PresentationSnapshot {
  dayIndex: number;
  date: string;
  summary: {
    dailyRevenue: number;
    dailyCharity: number;
    dailyFees: number;
    dailyPayouts: number;
    netChange: number;
  };
  timelineTick: PresentationTimelineTick;
  financialWorkflow: PresentationWorkflow;
  charts: PresentationCharts;
}

export interface PresentationTimelineTick {
  label: string;
  cumulativeRevenue: number;
  cumulativePlayers: number;
  cumulativeFees: number;
  cumulativeCharity: number;
  cumulativePayouts: number;
}

export interface PresentationWorkflow {
  nodes: PresentationWorkflowNode[];
  links: PresentationWorkflowLink[];
}

export interface PresentationWorkflowNode {
  id: string;
  label: string;
  aggregateValue: number;
  progress?: number;
  layers?: PresentationWorkflowLayer[];
}

export interface PresentationWorkflowLayer {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface PresentationWorkflowLink {
  id: string;
  source: string;
  target: string;
  value: number;
}

export interface PresentationCharts {
  distributionSeries: PresentationDistributionPoint[];
  accumulationSeries: PresentationAccumulationPoint[];
}

export interface PresentationDistributionPoint {
  category: string;
  value: number;
}

export interface PresentationAccumulationPoint {
  metric: string;
  cumulative: number;
}

export interface PresentationSnapshotOptions {
  scenarioId: string;
  parameters: PresentationScenarioParameters;
  coordinates: PresentationScenarioCoordinates;
  dailySnapshots: DailyAggregateSnapshot[];
  generatedAt?: Date;
}

export function buildPresentationSnapshotFile(
  options: PresentationSnapshotOptions
): PresentationSnapshotFile {
  const { dailySnapshots } = options;

  const lastSnapshot = dailySnapshots[dailySnapshots.length - 1];
  const timeline = lastSnapshot.timelineTicks[0];

  const totals = {
    players: lastSnapshot.totals.totalPlayers,
    activePlayers: lastSnapshot.totals.activePlayers,
    cumulativeRevenue: round(timeline.cumulativeRevenue),
    cumulativeCharity: round(timeline.cumulativeCharity),
    cumulativeFees: round(timeline.cumulativePlatformFees),
    cumulativePayouts: round(timeline.cumulativePlayerPayouts),
  };

  const days = dailySnapshots.map((snapshot, index) =>
    buildPresentationSnapshot(snapshot, index)
  );

  return {
    scenarioId: options.scenarioId,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    parameters: options.parameters,
    coordinates: options.coordinates,
    totals,
    days,
  };
}

function buildPresentationSnapshot(
  snapshot: DailyAggregateSnapshot,
  index: number
): PresentationSnapshot {
  const timeline = snapshot.timelineTicks[0];
  const summary = {
    dailyRevenue: round(snapshot.totals.revenue),
    dailyCharity: round(snapshot.totals.charity),
    dailyFees: round(snapshot.totals.platformFees),
    dailyPayouts: round(snapshot.totals.playerPayouts),
    netChange: round(snapshot.totals.revenue - snapshot.totals.playerPayouts),
  };

  return {
    dayIndex: index,
    date: snapshot.date,
    summary,
    timelineTick: {
      label: `Day ${snapshot.day}`,
      cumulativeRevenue: round(timeline.cumulativeRevenue),
      cumulativePlayers: snapshot.totals.totalPlayers,
      cumulativeFees: round(timeline.cumulativePlatformFees),
      cumulativeCharity: round(timeline.cumulativeCharity),
      cumulativePayouts: round(timeline.cumulativePlayerPayouts),
    },
    financialWorkflow: buildWorkflow(snapshot),
    charts: buildCharts(snapshot),
  };
}

function buildWorkflow(snapshot: DailyAggregateSnapshot): PresentationWorkflow {
  const nodes = snapshot.workflowNodes;
  const totalRevenue = snapshot.totals.revenue;

  const workflowNodes: PresentationWorkflowNode[] = [
    {
      id: "total",
      label: "Total Revenue",
      aggregateValue: round(totalRevenue),
      progress: 1,
    },
    ...nodes.map((node) => ({
      id: node.id,
      label: node.label,
      aggregateValue: round(node.amount),
      progress: clampPercentage(node.percentageOfTotal / 100),
      layers: node.layers?.map((layer) => ({
        id: layer.id,
        label: layer.label,
        value: round(layer.amount),
        color: mapLayerColor(layer.id),
      })),
    })),
  ];

  const workflowLinks: PresentationWorkflowLink[] = nodes.map((node) => ({
    id: `total->${node.id}`,
    source: "total",
    target: node.id,
    value: round(node.amount),
  }));

  return {
    nodes: workflowNodes,
    links: workflowLinks,
  };
}

function buildCharts(snapshot: DailyAggregateSnapshot): PresentationCharts {
  const distributionSeries: PresentationDistributionPoint[] = [
    { category: "platformFees", value: round(snapshot.totals.platformFees) },
    { category: "charity", value: round(snapshot.totals.charity) },
    { category: "playerPayouts", value: round(snapshot.totals.playerPayouts) },
  ];

  const timeline = snapshot.timelineTicks[0];
  const accumulationSeries: PresentationAccumulationPoint[] = [
    {
      metric: "platformFees",
      cumulative: round(timeline.cumulativePlatformFees),
    },
    {
      metric: "charity",
      cumulative: round(timeline.cumulativeCharity),
    },
    {
      metric: "playerPayouts",
      cumulative: round(timeline.cumulativePlayerPayouts),
    },
    { metric: "revenue", cumulative: round(timeline.cumulativeRevenue) },
  ];

  return {
    distributionSeries,
    accumulationSeries,
  };
}

function mapLayerColor(id: string): string {
  switch (id) {
    case "fees":
      return "#38bdf8";
    case "donations":
      return "#f472b6";
    case "winnings":
      return "#34d399";
    default:
      return "#94a3b8";
  }
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function mapParametersToScenario(
  combination: {
    growthRate: number;
    riskLevel: string;
    charityPercentage: number;
  }
): {
  parameters: PresentationScenarioParameters;
  coordinates: PresentationScenarioCoordinates;
} {
  return {
    parameters: {
      adoptionRate: mapGrowthRateToLabel(combination.growthRate),
      cashOutStrategy: combination.riskLevel,
      charityShare: `${combination.charityPercentage}`,
    },
    coordinates: {
      adoptionRate: mapGrowthRateToCoordinate(combination.growthRate),
      cashOutStrategy: mapRiskLevelToCoordinate(combination.riskLevel),
      charityShare: mapCharityToCoordinate(combination.charityPercentage),
    },
  };
}

function mapGrowthRateToLabel(rate: number): string {
  switch (rate) {
    case 15:
      return "low";
    case 35:
      return "mid";
    case 60:
      return "high";
    default:
      return `${rate}`;
  }
}

function mapGrowthRateToCoordinate(rate: number): number {
  switch (rate) {
    case 15:
      return 0;
    case 35:
      return 0.5;
    case 60:
      return 1;
    default:
      return 0;
  }
}

function mapRiskLevelToCoordinate(risk: string): number {
  switch (risk) {
    case "low":
      return 0;
    case "mid":
      return 0.5;
    case "high":
      return 1;
    default:
      return 0;
  }
}

function mapCharityToCoordinate(charity: number): number {
  switch (charity) {
    case 10:
      return 0;
    case 20:
      return 0.5;
    case 30:
      return 1;
    default:
      return 0;
  }
}
