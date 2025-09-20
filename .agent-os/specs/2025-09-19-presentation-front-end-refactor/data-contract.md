# Presentation Data Contract Plan

## Snapshot Overview
- Source: Simulation snapshot aggregator (daily JSON artefacts assumed ready before UI work).
- Scope: Up to 365 sequential days per dataset, consumed entirely on the client.
- Format: Array of `SimulationSnapshot` records persisted alongside metadata describing scenario parameters and grid coordinates.

## Core Schema (TypeScript)
```ts
export interface SimulationSnapshotFile {
  scenarioId: string;
  generatedAt: string; // ISO timestamp
  parameters: ScenarioParameters; // identifying coordinates within the anchor grid
  coordinates: ScenarioCoordinates; // numeric representation for interpolation (0-1 range per axis)
  totals: {
    players: number;
    activePlayers: number;
    cumulativeRevenue: number;
    cumulativeCharity: number;
    cumulativeFees: number;
    cumulativePayouts: number;
  };
  days: SimulationSnapshot[];
}

export interface ScenarioParameters {
  adoptionRate: string; // e.g., "low", "mid", "high" (or numeric string)
  cashOutStrategy: string;
  charityShare: string;
  [key: string]: string;
}

export interface ScenarioCoordinates {
  adoptionRate: number; // normalized 0-1 value
  cashOutStrategy: number;
  charityShare: number;
  [key: string]: number;
}

export interface SimulationSnapshot {
  dayIndex: number; // 0-based
  date: string; // ISO date
  summary: {
    dailyRevenue: number;
    dailyCharity: number;
    dailyFees: number;
    dailyPayouts: number;
    netChange: number;
  };
  timelineTick: {
    label: string;
    cumulativeRevenue: number;
    cumulativePlayers: number;
  };
  financialWorkflow: {
    nodes: WorkflowNode[];
    links: WorkflowLink[];
  };
  charts: {
    distributionSeries: DistributionPoint[];
    accumulationSeries: AccumulationPoint[];
  };
}

export interface WorkflowNode {
  id: string;
  label: string;
  aggregateValue: number;
  progress?: number; // 0-1
  layers?: WorkflowLayer[];
}

export interface WorkflowLayer {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface WorkflowLink {
  id: string;
  source: string;
  target: string;
  value: number;
}

export interface DistributionPoint {
  category: string;
  value: number;
}

export interface AccumulationPoint {
  metric: string;
  cumulative: number;
}
```

## Scenario Manifest
- Aggregator exports a `scenario-manifest.json` listing all available anchors with their `scenarioId`, `parameters`, `coordinates`, and filesystem path.
- UI loader consumes the manifest to build lookup tables for exact matches and to drive interpolation helpers when a requested combination falls between anchors.
- Example manifest entry:
```json
{
  "scenarioId": "anchor-001",
  "path": "engine/generated-datasets/anchor-001.json",
  "parameters": {
    "adoptionRate": "low",
    "cashOutStrategy": "balanced",
    "charityShare": "20"
  },
  "coordinates": {
    "adoptionRate": 0,
    "cashOutStrategy": 0.5,
    "charityShare": 0.25
  }
}
```

## Loader Strategy
- Load the scenario manifest on app start, then fetch the referenced snapshot JSON lazily (or eagerly for demo scenarios).
- Normalize snapshots into maps keyed by `dayIndex` for O(1) lookup during scrubbing and index scenarios by both `scenarioId` and parameter coordinates.
- Precompute derived aggregates (e.g., `nextSnapshotLabel`, normalized percentages) within the loader to keep components lean.
- Provide interpolation utilities that, given desired parameter coordinates, select nearest anchors (for 3×3×3 grid) and blend metrics; scale seamlessly when additional anchors (e.g., 5×5×5) are added.
- Expose selectors via a shared store module (`useSimulationSnapshot()` hook) to hydrate timeline, workflow, charts, and any parameter-aware UI.

## Performance Notes
- Precompute Framer Motion-friendly arrays (e.g., node positions, link paths) during normalization to avoid expensive calculations on each render.
- Memoize chart datasets based on active day to minimize re-renders when scrubbing quickly.
- Consider lazy-loading extended ranges (e.g., monthly chunks) if dataset size approaches memory limits, though presentation scope expects one scenario at a time.
- Cache interpolation results for repeated parameter requests during presentations.

## Testing & Validation
- Add unit tests covering schema parsing, default fallbacks, manifest ingestion, and contract invariants (e.g., every link references existing nodes).
- Provide a sample snapshot file under `engine/generated-datasets/presentation-snapshot.json` and a companion manifest entry for front-end integration tests.
- Validate against JSON Schema if aggregator supplies one; otherwise, generate from the TypeScript contracts above and share with the simulation team.
- Include tests ensuring interpolation utilities return stable outputs when anchor grids expand.
