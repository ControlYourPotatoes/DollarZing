# Workflow Nodes: Comparison Rings Plan

## Intent

Introduce two concentric comparison layers (Mid and High) around each financial workflow node, using the existing custom SVG primitives. The inner node remains the Base scenario (worst-case/anchor). Rings visualize uplift deltas for Mid/High relative to Base. Details stay mostly hidden; hover/focus reveals rich breakdowns.

## Data Overview (from generated datasets)
- Manifest enumerates a 3×3×3 grid via `adoptionRate` (low/mid/high), `cashOutStrategy` (low/mid/high), `charityShare` (10/20/30).
- Day snapshots include:
  - `timelineTick.cumulative*` aggregates (revenue, fees, charity, payouts, players)
  - `financialWorkflow.nodes` with optional `layers` (currently single sublayer per node)
  - `financialWorkflow.links` representing distribution from `total` to categories

## Mapping to Layers and Segments
- Base: the currently active scenario/day. Interpreted as worst case anchor.
- Mid/High: comparison scenarios at the same `dayIndex`, same `charityShare`, with `adoptionRate` and `cashOutStrategy` set to `mid` and `high` respectively.
- Node values by id: `total`, `platform`, `charity`, `players` come from cumulative ticks: revenue, fees, charity, payouts.
- Deltas: `deltaMid = max(0, mid - base)`, `deltaHigh = max(0, high - base)`.
- Segmentation:
  - Use node `layers` to segment rings when multiple categories exist. Align by `layer.id` across scenarios if available.
  - If only one layer is present (current shape), the ring is a single full segment using that layer’s color.
  - Consider keeping `total` comparison rings unsegmented for clarity; segment child nodes (platform/charity/players).

## Visual Design
- Inner circle: Base amount; primary label + currency value.
- Rings (concentric):
  - Base ring (existing): `layers[]` as arcs at radius `r-6`.
  - Mid ring: uplift vs Base at radius `r` (thin stroke, 40–60% opacity; brightens on hover).
  - High ring: uplift vs Base at radius `r+6` (thin stroke, 30–50% opacity; brightens on hover).
- Minimal state (default):
  - Show faint Mid/High rings without labels; 1–2px stroke; low opacity.
  - Links unchanged; optionally dim except when node is hovered.
- Hover/focus state:
  - Thicken Mid/High rings to 4–5px and animate arc dashoffset to reveal.
  - Tooltip/panel shows Base, Mid, High totals; absolute/percent uplift; per-segment list when segmented.

## Interaction & Accessibility
- Hover and keyboard focus both trigger the expanded state (`onFocus` uses existing wiring).
- Ensure focus ring/outline is visible; arrow/Tab cycles nodes.
- Tooltip content: semantic list; currency formatted; percent uplift calculated vs Base.

## Scenario Selection Strategy
- Base: current active scenario from the store.
- Mid: scenario with same `charityShare`, `adoptionRate=mid`, `cashOutStrategy=mid`.
- High: scenario with same `charityShare`, `adoptionRate=high`, `cashOutStrategy=high`.
- Fallbacks: if a comparison scenario/day is missing, omit that ring. Do not show negative deltas (clamp at 0) since Base is intended as worst case.

## Data Transform Sketch

```ts
// Pseudocode: build comparison payload per node id
function buildComparisonRings(baseDay, midDay?, highDay?) {
  const ids = ['total','platform','charity','players'] as const;
  const collect = (day) => ({
    total: day.timelineTick.cumulativeRevenue,
    platform: day.timelineTick.cumulativeFees,
    charity: day.timelineTick.cumulativeCharity,
    players: day.timelineTick.cumulativePayouts,
  });
  const base = collect(baseDay);
  const mid = midDay ? collect(midDay) : undefined;
  const high = highDay ? collect(highDay) : undefined;

  return ids.map((id) => {
    const baseValue = base[id];
    const midValue = mid ? mid[id] : undefined;
    const highValue = high ? high[id] : undefined;

    const deltaMid = midValue !== undefined ? Math.max(0, midValue - baseValue) : 0;
    const deltaHigh = highValue !== undefined ? Math.max(0, highValue - baseValue) : 0;

    // Segment alignment by base layers
    const baseNode = baseDay.financialWorkflow.nodes.find(n => n.id === id);
    const baseLayers = baseNode?.layers ?? [];
    const defaultSeg = baseLayers[0] ?? { id: 'value', label: 'Value', color: '#64748b' };

    const midSegments = deltaMid > 0 ? [{ id: defaultSeg.id, label: 'Δ mid', value: deltaMid, color: defaultSeg.color }] : [];
    const highSegments = deltaHigh > 0 ? [{ id: defaultSeg.id, label: 'Δ high', value: deltaHigh, color: defaultSeg.color }] : [];

    return { id, baseValue, midValue, highValue, midSegments, highSegments };
  });
}
```

## API Proposal (display-only extensions)
- Extend display payload in `useWorkflowData` (do not mutate `PresentationWorkflowNode` types) to include:

```ts
interface RingSegment { id: string; label: string; value: number; color: string }
interface PositionedNodeDisplayExtras {
  midSegments?: RingSegment[];
  highSegments?: RingSegment[];
  baseValue?: number; midValue?: number; highValue?: number;
}
```

- Pass these as props to `WorkflowNode` for rendering extra concentric rings.

## Component Changes
- `WorkflowNode.tsx`
  - New props: `midSegments?: RingSegment[]`, `highSegments?: RingSegment[]`.
  - Render three concentric arc sets at radii `r-6` (base), `r` (mid), `r+6` (high), using existing dasharray arc logic.
  - Style: thinner strokes and lower default opacity for comparison rings; animate on `isActive`.
- `FinancialWorkflowDiagram.tsx`
  - Tooltip: show Base/Mid/High values, absolute/percent uplift; list segments if multiple.
- `useWorkflowData.ts`
  - Load comparison scenarios from manifest using current scenario’s `parameters.charityShare`.
  - For the active `dayIndex`, compute ring segments and attach display extras to positioned nodes.
  - Resilient fallbacks when comparison day count differs.

## Why Not Nivo Sunburst
- We need node-link layout with custom hover/keyboard behavior and minimal in-node visuals. Nivo Sunburst is a full chart with its own layout and interaction model; embedding it per node would be heavyweight and less controllable. Our existing SVG arc approach is lightweight and precise.

## Performance Notes
- Precompute deltas in `useMemo` keyed by (scenarioId, dayIndex).
- Keep arrays stable to minimize re-renders; avoid recreating color objects.
- Limit stroke animations to hovered node to reduce layout thrash.

## Open Questions
- Confirm Base = current active scenario and is indeed the worst case.
- Should `total` node’s comparison rings be segmented or single-arc?
- Any desire to show negative deltas as red inward ticks if encountered later?

## Implementation Tasks
1. Data plumbing
   - [ ] Read scenario manifest and index by `adoptionRate`, `cashOutStrategy`, `charityShare`.
   - [ ] Given active scenario, resolve Mid/High comparison scenarioIds (same `charityShare`).
   - [ ] For active `dayIndex`, locate corresponding days; handle missing gracefully.
   - [ ] Compute per-node deltas and build `midSegments`/`highSegments`.
2. Components
   - [ ] Extend `WorkflowNode` with `midSegments`/`highSegments` props and concentric ring rendering.
   - [ ] Update `FinancialWorkflowDiagram` to pass new props and enhance tooltip with uplifts.
3. Styling & Motion
   - [ ] Add tokenized opacities and stroke sizes for base/mid/high rings.
   - [ ] Animate ring reveal on hover/focus; ensure keyboard parity.
4. Docs & QA
   - [ ] Document comparison logic and props in this spec and component JSDoc.
   - [ ] Add a story/demo toggling Base/Mid/High scenarios for visual verification.

---

Owner: Presentation/Timeline Guild
Last updated: 2025-09-23
