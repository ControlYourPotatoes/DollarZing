# Recommendation: Implementing Proper Sunburst Nodes for Financial Workflow Visualization

This document provides a comprehensive guide to implementing true sunburst-style nodes in the `WorkflowNode` component (from `src/features/financial-flow/components/WorkflowNode.tsx`). The goal is to create visually distinct, interactive radial charts that represent financial distributions (e.g., platform fees, charity donations, player payouts) as individual pie-like slices, enabling clear comparisons across scenarios (e.g., base actuals, mid-risk projections, high-risk projections). This addresses issues like clustered or flat rings in the current dashed-circle implementation.

The recommendations build on the existing shared utilities in `src/shared/presentation/` (e.g., `loader.ts`, `normalizer.ts`, `interpolation.ts`, `scenario-index.ts`). Focus is on:
- **Data Preparation**: Enhance `normalizer.ts` to output sunburst-ready props (e.g., normalized `layers`, `midSegments`, `highSegments` with values, colors, and percentages).
- **Component Enhancements**: Update `WorkflowNode.tsx` to use D3 arcs for radial slices, with tuned spacing to fix clustering.
- **Integration**: Wire into the parent `FinancialWorkflowDiagram.tsx` using loader and interpolation for dynamic scenarios.
- **Future-Proofing**: Placeholders for daily cumulatives (add to simulation output) and multi-level hierarchies (e.g., sub-layers under "players").

These changes keep the frontend visually appealing (smooth Framer Motion animations, tooltips) while leveraging your simulation data (from `daily-snapshots.json` and `presentation-snapshots.json`). Snippets are provided as drop-in references—test incrementally.

## 1. Prerequisites and Dependencies
- **Install D3**: For arc generation (radial sunburst slices).
  ```
  npm install d3 @types/d3
  ```
- **Existing Types**: Use `PresentationWorkflowLayer` from `@/shared/presentation` (extend if needed for sunburst support, e.g., add `startAngle`, `endAngle` for computed arcs).
- **Data Assumptions**: Based on your shared structure:
  - `daily-snapshots.json`: Granular per-day `workflowNodes` with `layers` (e.g., `{id: 'fees', amount: 13.2}`).
  - `presentation-snapshots.json`: Aggregated with `financialWorkflow.nodes` and `links`.
  - `presentation-manifest.json`: Scenario index for interpolations (e.g., growth-15_risk-high_charity-10).
  - Projections: Use `interpolation.ts` to blend scenarios for `midSegments`/`highSegments`.

If your simulation adds daily perplexity boosts (e.g., per-layer cumulatives), the normalizer can compute running sums.

## 2. Data Loading with Shared Utilities
Use `loader.ts` for robust, cached loading of snapshots and manifests. This handles validation and normalization without boilerplate in components.

### Usage in Parent Component (e.g., `FinancialWorkflowDiagram.tsx`)
```tsx
import { loadAndNormalizeSnapshot, loadManifestFromBase, createScenarioIndex } from '@/shared/presentation/loader';
// In useEffect or onMount
async function loadData() {
  const manifest = await loadManifestFromBase(); // Loads /engine/generated-datasets/anchor-datasets/presentation-manifest.json
  const index = createScenarioIndex(manifest); // From scenario-index.ts

  // Load a specific scenario (e.g., from UI selector)
  const normalizedScenario = await loadAndNormalizeSnapshot(`/engine/generated-datasets/anchor-datasets/${scenarioId}/presentation-snapshots.json`);

  // For comparisons: Interpolate mid/high (from interpolation.ts)
  const requestedCoords = { adoptionRate: 0.5, cashOutStrategy: 0.5, charityShare: 0.5 }; // Dynamic from UI
  const interpResult = computeInterpolationAnchors(index, requestedCoords); // Returns anchors with weights
  const midScenarioId = pickBestAnchor(interpResult).scenarioId;
  const midNormalized = await loadAndNormalizeSnapshot(`/engine/generated-datasets/anchor-datasets/${midScenarioId}/presentation-snapshots.json`);
  // Similarly for high

  // Prepare nodes from normalized days (see Section 3)
  const nodesByDay = prepareNodesForDiagram(normalizedScenario.days); // Custom util below
  setData({ manifest, index, nodesByDay, midNormalized /* ... */ });
}
```

- **Caching**: `fetchJson` caches JSON by URL (clear with `clearCache()` for dev reloads).
- **Validation**: `loader.ts` delegates to `validation.ts` (not shown), ensuring data integrity (e.g., coordinates in [0,1]).
- **Error Handling**: Throws contextual errors (e.g., "Failed to load from URL"), catch in UI for user-friendly messages.
- **Performance Tip**: For 365 days, load on-demand (e.g., paginate days via `dayLookup` in normalized output).

## 3. Enhancing the Normalizer for Sunburst Props
The current `normalizer.ts` outputs `NormalizedPresentationScenario` with `days`, `charts.distributionSeries`, and `financialWorkflow`. To support sunburst nodes, extend it to compute:
- `layers`: Base slices from actual data (`workflowNodes` or `distributionSeries`).
- `midSegments`/`highSegments`: Projected slices (scale `layers` using interpolation weights).
- `cumulativeAmount`: Running sum per layer (placeholder; update sim backend to output).

### Recommended Changes to `normalizer.ts`
Add these functions/exports after the existing `normalizePresentationSnapshot`. This keeps the canonical normalizer focused while adding sunburst-specific prep.

```tsx
// Add to normalizer.ts (after existing exports)

// Extend types if needed (in types.ts)
export interface SunburstNormalizedNode {
  id: string;
  label: string;
  aggregateValue: number; // Node total (e.g., platform fees)
  baseValue?: number; // Current day
  midValue?: number; // Mid projection
  highValue?: number; // High projection
  layers: PresentationWorkflowLayer[]; // Sunburst slices for base (with value, color, percentage)
  midSegments: PresentationWorkflowLayer[]; // Scaled for mid scenario
  highSegments: PresentationWorkflowLayer[]; // Scaled for high
  cumulativeAmount?: number; // Running cumulative (add to sim output)
  percentageOfTotal: number;
}

// Util to prepare sunburst nodes from a single day's financialWorkflow or charts
function prepareSunburstNodesForDay(
  day: NormalizedPresentationDay, // From existing normalizePresentationSnapshot
  scenarioProjections?: { mid: number; high: number } // From interpolation weights (e.g., {mid: 1.2, high: 1.5})
): SunburstNormalizedNode[] {
  const totalDaily = day.charts.distributionTotal || day.timelineTick.cumulativeRevenue || 0;
  const nodes: SunburstNormalizedNode[] = [];

  // Map from financialWorkflow.nodes (prioritize this over charts for layered structure)
  const workflowNodes = day.financialWorkflow?.nodes || [];
  workflowNodes.forEach((nodeData: any) => {
    // Base layers (actual slices from layers or distributionSeries)
    const layers: PresentationWorkflowLayer[] = (nodeData.layers || day.charts.distributionSeries.filter(s => s.category.includes(nodeData.id)))
      .map((layer: any): PresentationWorkflowLayer => ({
        id: layer.id || layer.category,
        label: layer.label || layer.name,
        value: layer.value || layer.amount || 0,
        color: layer.color || getColorForLayer(layer.id), // Helper below
        percentage: (layer.value / totalDaily) * 100,
      }));

    const baseValue = nodeData.aggregateValue || layers.reduce((sum, l) => sum + l.value, 0);

    // Projections: Scale using scenarioProjections (from interpolation.ts)
    const midValue = scenarioProjections?.mid ? baseValue * scenarioProjections.mid : baseValue * 1.2; // Mid-risk boost
    const highValue = scenarioProjections?.high ? baseValue * scenarioProjections.high : baseValue * 1.5; // High-risk
    const midSegments = layers.map(l => ({ ...l, value: (l.value / baseValue) * midValue })); // Pro-rate layers
    const highSegments = layers.map(l => ({ ...l, value: (l.value / baseValue) * highValue }));

    // Cumulative: Placeholder; will be added as running sum from daily-snapshots
    const cumulative = nodeData.cumulativeAmount || baseValue; // Fallback to current day

    nodes.push({
      id: nodeData.id,
      label: nodeData.label,
      aggregateValue: totalDaily,
      baseValue,
      midValue,
      highValue,
      layers,
      midSegments,
      highSegments,
      cumulativeAmount: cumulative,
      percentageOfTotal: (baseValue / totalDaily) * 100,
    });
  });

  return nodes;
}

// Export for multi-day prep (integrate into normalized scenario if desired)
export function prepareNodesForDiagram(
  normalizedScenario: NormalizedPresentationScenario,
  scenarioProjections?: { mid: number; high: number }
): { nodesByDay: SunburstNormalizedNode[][]; projections: { mid: number; high: number } } {
  const nodesByDay: SunburstNormalizedNode[][] = [];
  let runningCumulative = 0; // For future cumulative support

  normalizedScenario.days.forEach((day, index) => {
    const dayNodes = prepareSunburstNodesForDay(day, scenarioProjections);
    // Update cumulatives (once sim outputs per-layer cumulatives)
    // Example: dayNodes.forEach(node => node.cumulativeAmount = runningCumulative + node.baseValue);
    runningCumulative += day.charts.distributionTotal || 0;
    nodesByDay.push(dayNodes);
  });

  return { nodesByDay, projections: scenarioProjections || { mid: 1.2, high: 1.5 } };
}

// Helper for colors (consistent across nodes)
function getColorForLayer(id: string): string {
  const colors: Record<string, string> = {
    'fees': '#38bdf8', // Platform blue
    'donations': '#f472b6', // Charity pink
    'winnings': '#34d399', // Players green
    // Add more: e.g., 'progression': '#eab308'
  };
  return colors[id] || '#64748b'; // Default slate
}
```

- **Why Here?**: Keeps normalization central (UI-agnostic). Call `prepareNodesForDiagram` in the parent after loading via `loader.ts`. For comparisons, pass projections from `interpolation.ts` (e.g., weight-based scaling: `mid = anchor.weight * base`).
- **Handling Duplication**: As noted, `daily-snapshots` can omit `links` (handle in UI via `financialWorkflow.links`). Prioritize `presentation-snapshots` for aggregated views.
- **Daily Cumulatives**: Once added to sim (e.g., output `{cumulativeAmount: 24}` per layer), compute running sums here: `cumulative = previous + daily.value`. For now, use day-to-day fallback.
- **Validation**: Already handled in `loader.ts`; add checks in `prepareSunburstNodesForDay` (e.g., `if (!layers.length) return []`).

## 4. Updated WorkflowNode Component
Replace the existing dashed-circle logic with D3 arcs for true radial slices. This creates deconstructed sunbursts: base (inner/opaque), mid (middle/semi-transparent), high (outer/transparent). Tune `padAngle` for spacing.

### Snippet: Updated `WorkflowNode.tsx`
(See full code in previous responses; key excerpt for arcs/compute):
```tsx
// In computeArcs (add to component or util)
function computeArcs(segments: PresentationWorkflowLayer[], outerRadius: number) {
  if (!segments.length) return [];
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  if (total === 0) return [];
  let startAngle = 0;
  return segments.map((seg) => {
    const fraction = seg.value / total;
    const arcLengthRadians = 2 * Math.PI * fraction;
    const padAngle = Math.min(0.1, arcLengthRadians * 0.15); // 6-10% gap; fixes clustering
    const arc = { data: seg, startAngle, endAngle: startAngle + arcLengthRadians, padAngle };
    startAngle += arcLengthRadians + padAngle;
    return arc;
  });
}

// D3 Arc Generators (in useMemo)
const arcGen = d3.arc<d3.DefaultArcObject>()
  .innerRadius(0)  // For base; offset for mid/high
  .outerRadius(radius)
  .padAngle(0.08)  // Global gap; increase for sparse data
  .cornerRadius(4); // Smooth edges

// Render: <path d={arcGen(arcData)} fill={seg.color} ... />
```

- **Fixes for Sunburst Effect**: Arcs radiate from center (no dashes); slices are isolated (e.g., "fees" as 26.8% wedge).
- **Comparisons**: Render 3 rings concentrically; opacity gradients (1.0 base → 0.5 high) for overlay without clutter.
- **Interactivity**: Per-slice hover (e.g., `onHover(`${id}-layer-${i}`)`) with tooltips: "Fees: $13.2 (Day 1, Cum: $24)".
- **Animations**: Staggered Framer Motion (`delay: i * 0.05`) for burst-on-hover.
- **Accessibility**: ARIA labels include day/cumulative (e.g., "Platform Fees: $13.2 (Cum: $13.2) - Day 1").

## 5. Integration in Parent Diagram (FinancialWorkflowDiagram.tsx)
Use force layout for deconstructed positioning (side-by-side nodes, no overlap). Tie to timeline.

### Snippet: Parent Layout
```tsx
// In useEffect
const simulation = d3.forceSimulation(nodesByDay[activeDay])
  .force('charge', d3.forceManyBody().strength(-200)) // Repel for spacing
  .force('collide', d3.forceCollide().radius(radius * 1.5)) // Min distance
  .force('x', d3.forceX().x(i => i * 200)) // Horizontal deconstruction (node 0 at x=0, node 1 at x=200, etc.)
  .on('tick', updatePositions);

// Render
{normalizedData.nodesByDay[activeDay]?.map((node, i) => (
  <WorkflowNode
    key={node.id}
    node={node}
    dayIndex={activeDay + 1}
    x={positions[i]?.x || 100 + i * 200} // From sim or fixed
    y={positions[i]?.y || height / 2}
    radius={80}
    isActive={activeNode === node.id}
    onHover={setActiveNode}
  />
))}

// Links: From financialWorkflow.links (render <line> between node positions)
```

- **Deconstruction**: Position nodes horizontally (e.g., platform at x=100, charity at x=300) for side-by-side sunbursts.
- **Timeline**: Use `activeDay` to switch `nodesByDay`; add scrubber/slider.
- **Clustering Fix**: Force `collide` ensures min distance (tune `.radius(radius * 2)` for dense days).

## 6. Testing and Tuning
- **Sample Data**: Use Day 1 from `daily-snapshots.json`: `layers = [{id: 'fees', value: 13.2, color: '#38bdf8'}]`.
- **Visual Checks**:
  - Slices sum to 360° (log `arcs` to verify angles).
  - No Overlap: Increase `padAngle=0.12` or ring offsets (`outerRadius: radius + 25`).
  - Projections: Verify `midValue` scales correctly (e.g., base $13.2 → mid $15.84 via 1.2 factor).
- **Performance**: Memoize arcs (`useMemo`); for 365 days, virtualize (render 7 active days).
- **Edge Cases**: Empty layers (no arcs); zero total (skip render); interpolated exact-match (from `interpolation.ts`).
- **Mobile/Responsive**: Scale `radius` via viewport (e.g., `Math.min(width/5, 60)`).

## 7. Future Enhancements
- **Daily Breakdowns**: Once sim outputs per-layer cumulatives, compute gradients (e.g., color slices by change: green up, red down).
- **Hierarchical Sunbursts**: If layers nest (e.g., "winnings" → sub-types), use D3 `partition` for multi-depth arcs.
- **LLM Integration**: Feed node data to AI for insights (e.g., "Suggest color scheme for charity slice").
- **Exports**: Add PNG/CSV export of node views (via html2canvas or D3 data).

This setup makes nodes modular and data-driven. Implement in stages: 1) Update normalizer, 2) Test arcs in node, 3) Integrate loader. If issues (e.g., type errors), share `types.ts` for tweaks. References: Full snippets in chat history.