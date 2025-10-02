Here’s how I’d map your datasets into layered workflow nodes with hover-driven detail, aiming for a sunburst-like feel but customized to your data and existing primitives.

Key observations from datasets

Scenarios: 3×3×3 grid via adoptionRate (low/mid/high), cashOutStrategy (low/mid/high), charityShare (10/20/30). Each entry links to a presentation-snapshots.json.
Day snapshots: contain financialWorkflow.nodes with aggregateValue and optional layers (currently one sublayer per node), plus timelineTick.cumulative* totals.
Current UI already normalizes to cumulative totals per day and renders nodes/links. WorkflowNode supports layered arcs via layers[].
Interpretation for “two layers on the node”

Base scenario: Your “low” baseline is the reference. Nodes should always show baseline ring minimally.
Comparison layers: Add mid and high as stacked/overlaid rings around the same node to show how much better they are than base. Since you want the nodes to focus on custom SVG and other charts handle broader comparison, keep it to two outer layers: mid and high deltas vs base.
Recommended node structure

Inner circle: base cumulative value (filled label with total).
Layer 1 (inner ring): Mid vs Base delta, segmented by categories (fees, charity, payouts) if you want multi-segment arcs.
Layer 2 (outer ring): High vs Base delta, segmented similarly.
Minimal state: show faint thin rings (low opacity) with small tick marks; labels hidden.
Hover state: expand stroke width and opacity for the hovered node; animate arc reveal with dashoffset; show tooltip panel (you already have summary panel) listing:
Base total, Mid total, High total
Per-segment deltas with color chips
Percent uplift vs base
Segments vs single ring

Segments: Your dataset layers already include a single layer per node. For sunburst-like segments, compute derived segments per node based on contribution categories. Your data naturally divides into:
Platform: fees
Charity: donations
Players: winnings
Total: can be segmented by the three outgoing flows (fees, charity, payouts) from links; or keep total as a single aggregate and only segment the comparison rings.
Suggestion: Segment the comparison rings (mid/high) by the same categories used in the node’s layers. That keeps color semantics consistent and makes rings comparable across nodes. If a node has one category (e.g., platform fees), the ring is a single full arc.
Data mapping plan

Choose the current active “base” scenario as the left-most in coordinates (adoption low, cashOut low, charity N) that matches the day index. Or define base = “risk-low” if that’s your worst case.
For the same day index across scenarios:
Compute cumulative values for each node id: total, platform, charity, players.
For each node:
baseValue = base cumulative
midValue = mid cumulative
highValue = high cumulative
deltaMid = max(0, midValue - baseValue)
deltaHigh = max(0, highValue - baseValue)
For segmentation of rings:
If node has layers in base, mid, high, align by layer.id and compute delta per layer id.
If only base has layers (current shape), treat mid/high as same category structure; i.e., take the single category and apply the whole delta to it. Later you can enrich mid/high snapshots to have layers too.
Rendering approach: custom vs Nivo

Use your existing custom WorkflowNode primitives; they already support arc segments (stroke-dasharray) and hover animations via Framer Motion. Nivo Sunburst would fight your custom layout, hover logic, and node-link diagram context.
Extend WorkflowNode to accept two additional ring sets: midSegments[] and highSegments[], each as arrays of { id, color, value } where value is delta vs base. Compute arc fractions off the sum of that ring’s deltas. Use distinct ring radii and subtle styles:
Base ring: current arcs (from base layers) with normal opacity.
Mid ring: radius r-0, thin stroke, color modifiers (e.g., color with 70% opacity).
High ring: radius r+6, thin stroke, 50–60% opacity in minimal state; brighten on hover.
Keep links unchanged; they can optionally thicken on hover to show the primary flow.
Minimal and hover states

Minimal (default):
Base node circle visible with label and base amount.
Mid/high rings: 1px–2px stroke, 30–40% opacity, no labels.
Hover (node focus or keyboard focus):
Increase ring stroke to 4px–5px; ease opacity to 90%.
Animate arc dashoffset from full circumference to target.
Tooltip shows:
Base, Mid, High totals
Uplifts: +$X (+Y%) for mid and high
Segment breakdowns only when there is more than one segment.
Keyboard: you already wire focus to onHover; ensure focus rings and enter/space expand details.
Data transform sketch

Source: the active “base” day plus two comparison days for mid and high scenarios (same dayIndex).

Transform to node payload with rings:

function buildComparisonRings(baseDay, midDay, highDay) {
const nodeIds = ['total','platform','charity','players'];
const collect = (day) => ({
total: day.timelineTick.cumulativeRevenue,
platform: day.timelineTick.cumulativeFees,
charity: day.timelineTick.cumulativeCharity,
players: day.timelineTick.cumulativePayouts,
});
const base = collect(baseDay);
const mid = collect(midDay);
const high = collect(highDay);

return nodeIds.map((id) => {
const baseValue = base[id];
const midValue = mid[id];
const highValue = high[id];
const deltaMid = Math.max(0, midValue - baseValue);
const deltaHigh = Math.max(0, highValue - baseValue);

// segments: align by layer ids if available
const baseLayers = (baseDay.financialWorkflow.nodes.find(n => n.id===id)?.layers) ?? [];
// If only 1 base layer, just one segment
const segmentId = baseLayers[0]?.id ?? 'value';
const color = baseLayers[0]?.color ?? '#64748b';

const midSegments = deltaMid > 0 ? [{ id: segmentId, label: 'Δ mid', value: deltaMid, color }] : [];
const highSegments = deltaHigh > 0 ? [{ id: segmentId, label: 'Δ high', value: deltaHigh, color }] : [];

return { id, baseValue, midValue, highValue, midSegments, highSegments };
});
}

UI changes needed

Extend PresentationWorkflowNode shape in @/shared/presentation to optionally carry midSegments and highSegments or add a display-only wrapper type in useWorkflowData.
Update WorkflowNode to render up to three concentric arc sets:
Base: existing layers (radius r-6).
Mid: new midSegments (radius r, thinner stroke, lower opacity).
High: new highSegments (radius r+6, thinner stroke, lower opacity).
Update FinancialWorkflowDiagram tooltip to show base/mid/high with uplift.
Why not Nivo here

You need concentric comparison rings per node in a link-based flow layout, not a standalone hierarchical partition. Nivo Sunburst is a full chart with its own layout and interaction model; embedding inside each node would be heavyweight and less controllable. Your arc-rendering approach is already lightweight and precise.
Open questions to confirm

Which exact scenarios should be the “mid” and “high” comparisons? Based on manifest, I’d map:
base = adoption low, cashOut low, charity = current timeline’s chosen charity tier (or lowest)
mid = adoption mid, cashOut mid, same charity
high = adoption high, cashOut high, same charity
Do you want negative deltas (worse than base) to show as inner red ticks or to clamp at zero and indicate parity? You said base is worst case; so clamping at zero is fine.
Should total node display segmented rings for mid/high or keep total as just a single uplift arc? I’d keep total as a single arc for clarity and segment only the child nodes.
If you like this direction, I can:

Add a comparison builder in useWorkflowData to pull matching day indices from the mid/high scenarios already in presentation-manifest.json.
Extend WorkflowNode to accept and render midSegments and highSegments with minimal/hover behavior.
Update tooltip to show base/mid/high and uplifts.
Want me to implement the comparison rings scaffolding in useWorkflowData and WorkflowNode.tsx next?