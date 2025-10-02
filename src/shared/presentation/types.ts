/**
 * Parameters associated with an anchor scenario in the presentation snapshot manifest.
 */
export interface PresentationScenarioParameters {
  adoptionRate: string;
  cashOutStrategy: string;
  charityShare: string;
}

/**
 * Normalised coordinates for the anchor scenario. Each axis should be in the [0, 1] range.
 */
export interface PresentationScenarioCoordinates {
  adoptionRate: number;
  cashOutStrategy: number;
  charityShare: number;
}

export interface PresentationDistributionPoint {
  category: string;
  value: number;
}

export interface PresentationAccumulationPoint {
  metric: string;
  cumulative: number;
}

export interface PresentationWorkflowLayer {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface PresentationWorkflowNode {
  id: string;
  label: string;
  aggregateValue: number;
  progress?: number;
  layers?: PresentationWorkflowLayer[];
}

export interface PresentationWorkflowLink {
  id: string;
  source: string;
  target: string;
  value: number;
}

export interface PresentationWorkflow {
  nodes: PresentationWorkflowNode[];
  links: PresentationWorkflowLink[];
}

export interface PresentationTimelineTick {
  label: string;
  cumulativeRevenue: number;
  cumulativePlayers: number;
  cumulativeFees: number;
  cumulativeCharity: number;
  cumulativePayouts: number;
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
  charts: {
    distributionSeries: PresentationDistributionPoint[];
    accumulationSeries: PresentationAccumulationPoint[];
  };
  // Optional engine-provided blocks
  pool?: {
    depositedToday: number;
    consumedToday: number;
    outstanding: number;
  };
  cashouts?: {
    countToday: number;
    amountToday: number;
    cumulativeAmount?: number;
    cumulativeCount?: number;
  };
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
  engineDataset?: EngineScenarioDataset;
  engineDailySnapshots?: EngineDailySnapshot[];
}

export interface EngineScenarioDataset {
  success?: boolean;
  simulationDurationMs?: number;
  summary?: {
    totalDays?: number;
    totalPlayers?: number;
    simulationCompleted?: boolean;
  };
  revenueStats?: {
    totalPlatformRevenue?: number;
    totalCharityContributions?: number;
    totalPlayerPayouts?: number;
  };
  playerStats?: {
    totalPlayers?: number;
    activePlayers?: number;
  };
  dailyResults: EngineDailyResult[];
}

export interface EngineDailyResult {
  day: number;
  playerStatistics?: {
    totalPlayers?: number;
    activePlayers?: number;
    retiredPlayers?: number;
  };
  revenueStatistics?: {
    totalPlatformRevenue?: number;
    totalCharityContributions?: number;
    totalPlayerPayouts?: number;
  };
  gameStatistics?: {
    totalGames?: number;
    totalRunsCreated?: number;
  };
  newPlayers?: number;
}

export interface EngineDailySnapshotLevel {
  level: number;
  gamesPlayed?: number;
  wins?: number;
  cashouts?: number;
  progressions?: number;
  winnings?: number;
  losses?: number;
}

export interface EngineDailySnapshotTotals {
  revenue?: number;
  platformFees?: number;
  charity?: number;
  playerPayouts?: number;
  gamesPlayed?: number;
  activePlayers?: number;
  totalPlayers?: number;
  newPlayers?: number;
}

export interface EngineDailySnapshotTimelineTick {
  id?: string;
  label?: string;
  day?: number;
  cumulativePlatformFees?: number;
  cumulativeCharity?: number;
  cumulativePlayerPayouts?: number;
  cumulativeRevenue?: number;
  dailyPlatformFees?: number;
  dailyCharity?: number;
  dailyPlayerPayouts?: number;
  dailyRevenue?: number;
}

export interface EngineDailySnapshot {
  day: number;
  date?: string;
  totals?: EngineDailySnapshotTotals;
  timelineTicks?: EngineDailySnapshotTimelineTick[];
  levels?: EngineDailySnapshotLevel[];
}

export interface PresentationManifestEntry {
  scenarioId: string;
  path: string;
  parameters: PresentationScenarioParameters;
  coordinates: PresentationScenarioCoordinates;
  days: number;
  generatedAt: string;
}

export type PresentationManifest = PresentationManifestEntry[];

export interface NormalizedDistributionPoint
  extends PresentationDistributionPoint {
  percentage: number;
}

export interface NormalizedAccumulationPoint
  extends PresentationAccumulationPoint {}

export interface NormalizedPresentationDay {
  dayIndex: number;
  date: string;
  label: string;
  summary: PresentationSnapshot["summary"];
  timelineTick: PresentationTimelineTick;
  financialWorkflow: PresentationWorkflow;
  charts: {
    distributionSeries: NormalizedDistributionPoint[];
    distributionTotal: number;
    accumulationSeries: NormalizedAccumulationPoint[];
    accumulationMap: Record<string, number>;
  };
  pool?: PresentationSnapshot["pool"];
  cashouts?: PresentationSnapshot["cashouts"];
}

export interface NormalizedPresentationScenario {
  scenarioId: string;
  parameters: PresentationScenarioParameters;
  coordinates: PresentationScenarioCoordinates;
  totals: PresentationSnapshotFile["totals"];
  days: NormalizedPresentationDay[];
  dayLookup: Record<number, NormalizedPresentationDay>;
  duration: number;
  generatedAt: string;
  timelineSeries: {
    revenue: number[];
    charity: number[];
    fees: number[];
    payouts: number[];
    players: number[];
  };
  summary: {
    daysCount: number;
    firstDate?: string;
    lastDate?: string;
    totalRevenue: number;
    totalCharity: number;
    totalFees: number;
    totalPayouts: number;
    maxPlayers: number;
  };
  analytics: NormalizedScenarioAnalytics;
}

export interface CohortAnalyticsPoint {
  dayIndex: number;
  label: string;
  totalPlayers: number;
  activePlayers: number;
  survivalRate: number;
  cumulativeRevenue: number;
  cumulativePayouts: number;
  netValue: number;
}

export interface FlowAnalyticsPoint {
  dayIndex: number;
  label: string;
  cumulativeRevenue: number;
  cumulativePlatformFees: number;
  cumulativeCharity: number;
  cumulativePayouts: number;
}

export interface GamesAnalyticsPoint {
  dayIndex: number;
  label: string;
  totalGames: number;
  newPlayers: number;
}

export interface NormalizedScenarioAnalytics {
  cohort: CohortAnalyticsPoint[];
  flow: FlowAnalyticsPoint[];
  games: GamesAnalyticsPoint[];
  levels: LevelAnalyticsPoint[];
}

export interface LevelAnalyticsPoint {
  dayIndex: number;
  label: string;
  steps: LevelAnalyticsStep[];
}

export interface LevelAnalyticsStep {
  level: number;
  gamesPlayed: number;
  wins: number;
  cashouts: number;
  progressions: number;
  winnings: number;
  losses: number;
  survivalRate: number;
  retentionRate: number;
}

export interface ScenarioIndex {
  byId: Map<string, PresentationManifestEntry>;
  byCoordinateKey: Map<string, PresentationManifestEntry>;
  byAnchorKey: Map<string, PresentationManifestEntry>;
  manifest: PresentationManifest;
  axes: {
    adoptionRate: number[];
    cashOutStrategy: number[];
    charityShare: number[];
  };
}

export interface InterpolationAnchor {
  scenarioId: string;
  weight: number;
  entry: PresentationManifestEntry;
}

export interface InterpolationResult {
  anchors: InterpolationAnchor[];
  exactMatch: boolean;
  requested: PresentationScenarioCoordinates;
}
