const scenarioNodesBase = [
  { name: 'Dollars Initiated' },
  { name: 'Platform Fees' },
  { name: 'Charity Pool' },
  { name: 'Player Payouts' }
];

export const levelLabels = [
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7',
  'Level 8',
  'Level 9',
  'Level 10',
];

const baselineSurvival = [100, 62, 41, 26, 16, 9, 5, 3, 2, 1];
const baselineNet = [1.8, 3.4, 6.6, 12.8, 24.2, 45.8, 86.8, 164, 310, 586];

const createCohort = (survivalShift: number, netScale: number) =>
  levelLabels.map((level, index) => ({
    level,
    survival: Math.max(0, Math.round(baselineSurvival[index] * survivalShift - index * 1.1)),
    netValue: Number((baselineNet[index] * netScale).toFixed(1)),
  }));

interface FlowSummary {
  activePlayers: number;
  dollarsInitiated: number;
  cashOutRate: number;
  totalFees: number;
  totalCharity: number;
  netPayouts: number;
}

interface FlowBreakdownNode {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface ScenarioSnapshot {
  id: string;
  label: string;
  summary: FlowSummary;
  flowLinks: { source: number; target: number; value: number }[];
  breakdown: { total: number; nodes: FlowBreakdownNode[] };
  cohort: { level: string; survival: number; netValue: number }[];
  survivalHeatmap: number[];
}

export interface FlowScenario {
  id: string;
  label: string;
  timeSeries: ScenarioSnapshot[];
}

const createSnapshot = (
  id: string,
  label: string,
  summary: FlowSummary,
  cohort: { level: string; survival: number; netValue: number }[],
): ScenarioSnapshot => {
  const total = summary.totalFees + summary.totalCharity + summary.netPayouts;
  const survivalHeatmap = cohort.map((entry) => entry.survival);

  return {
    id,
    label,
    summary,
    flowLinks: [
      { source: 0, target: 1, value: summary.totalFees },
      { source: 0, target: 2, value: summary.totalCharity },
      { source: 0, target: 3, value: summary.netPayouts },
    ],
    breakdown: {
      total,
      nodes: [
        { id: 'fees', label: 'Platform Fees', value: summary.totalFees, color: '#38bdf8' },
        { id: 'charity', label: 'Charity Pool', value: summary.totalCharity, color: '#c084fc' },
        { id: 'payouts', label: 'Player Payouts', value: summary.netPayouts, color: '#34d399' },
      ],
    },
    cohort,
    survivalHeatmap,
  };
};

export const flowScenarios: FlowScenario[] = [
  {
    id: 'baseline',
    label: 'Growth 1.0 • Risk Balanced • Charity 10%',
    timeSeries: [
      createSnapshot(
        'week-1',
        'Week 1',
        {
          activePlayers: 1200,
          dollarsInitiated: 6000,
          cashOutRate: 0.41,
          totalFees: 580,
          totalCharity: 820,
          netPayouts: 4600,
        },
        createCohort(1.0, 1.0),
      ),
      createSnapshot(
        'week-4',
        'Week 4',
        {
          activePlayers: 1500,
          dollarsInitiated: 7500,
          cashOutRate: 0.43,
          totalFees: 720,
          totalCharity: 1020,
          netPayouts: 5960,
        },
        createCohort(1.05, 1.02),
      ),
      createSnapshot(
        'week-8',
        'Week 8',
        {
          activePlayers: 1800,
          dollarsInitiated: 9000,
          cashOutRate: 0.45,
          totalFees: 840,
          totalCharity: 1280,
          netPayouts: 6880,
        },
        createCohort(1.08, 1.05),
      ),
      createSnapshot(
        'week-12',
        'Week 12',
        {
          activePlayers: 2100,
          dollarsInitiated: 10500,
          cashOutRate: 0.46,
          totalFees: 940,
          totalCharity: 1460,
          netPayouts: 8120,
        },
        createCohort(1.12, 1.08),
      ),
      createSnapshot(
        'week-16',
        'Week 16',
        {
          activePlayers: 2300,
          dollarsInitiated: 11500,
          cashOutRate: 0.47,
          totalFees: 1020,
          totalCharity: 1600,
          netPayouts: 8980,
        },
        createCohort(1.15, 1.12),
      ),
    ],
  },
  {
    id: 'high-growth',
    label: 'Growth 1.4 • Risk Adventurous • Charity 10%',
    timeSeries: [
      createSnapshot(
        'week-1',
        'Week 1',
        {
          activePlayers: 1600,
          dollarsInitiated: 8000,
          cashOutRate: 0.36,
          totalFees: 640,
          totalCharity: 900,
          netPayouts: 6460,
        },
        createCohort(1.1, 1.0),
      ),
      createSnapshot(
        'week-4',
        'Week 4',
        {
          activePlayers: 2000,
          dollarsInitiated: 10000,
          cashOutRate: 0.34,
          totalFees: 790,
          totalCharity: 1150,
          netPayouts: 8060,
        },
        createCohort(1.18, 1.08),
      ),
      createSnapshot(
        'week-8',
        'Week 8',
        {
          activePlayers: 2400,
          dollarsInitiated: 12000,
          cashOutRate: 0.33,
          totalFees: 920,
          totalCharity: 1420,
          netPayouts: 9660,
        },
        createCohort(1.24, 1.15),
      ),
      createSnapshot(
        'week-12',
        'Week 12',
        {
          activePlayers: 2600,
          dollarsInitiated: 13000,
          cashOutRate: 0.32,
          totalFees: 1000,
          totalCharity: 1620,
          netPayouts: 10380,
        },
        createCohort(1.28, 1.2),
      ),
      createSnapshot(
        'week-16',
        'Week 16',
        {
          activePlayers: 2800,
          dollarsInitiated: 14000,
          cashOutRate: 0.31,
          totalFees: 1080,
          totalCharity: 1760,
          netPayouts: 11160,
        },
        createCohort(1.3, 1.24),
      ),
    ],
  },
  {
    id: 'high-charity',
    label: 'Growth 1.0 • Risk Balanced • Charity 20%',
    timeSeries: [
      createSnapshot(
        'week-1',
        'Week 1',
        {
          activePlayers: 1150,
          dollarsInitiated: 5750,
          cashOutRate: 0.38,
          totalFees: 560,
          totalCharity: 1100,
          netPayouts: 3780,
        },
        createCohort(0.95, 0.85),
      ),
      createSnapshot(
        'week-4',
        'Week 4',
        {
          activePlayers: 1350,
          dollarsInitiated: 6750,
          cashOutRate: 0.37,
          totalFees: 630,
          totalCharity: 1320,
          netPayouts: 4210,
        },
        createCohort(0.96, 0.88),
      ),
      createSnapshot(
        'week-8',
        'Week 8',
        {
          activePlayers: 1600,
          dollarsInitiated: 8000,
          cashOutRate: 0.36,
          totalFees: 710,
          totalCharity: 1540,
          netPayouts: 4750,
        },
        createCohort(0.97, 0.9),
      ),
      createSnapshot(
        'week-12',
        'Week 12',
        {
          activePlayers: 1750,
          dollarsInitiated: 8750,
          cashOutRate: 0.35,
          totalFees: 770,
          totalCharity: 1700,
          netPayouts: 4980,
        },
        createCohort(0.98, 0.92),
      ),
      createSnapshot(
        'week-16',
        'Week 16',
        {
          activePlayers: 1850,
          dollarsInitiated: 9250,
          cashOutRate: 0.34,
          totalFees: 820,
          totalCharity: 1840,
          netPayouts: 5090,
        },
        createCohort(0.99, 0.94),
      ),
    ],
  },
];

export const formatPercent = (value: number) => `${Math.round(value)}%`;
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export const sankeyNodes = scenarioNodesBase;
