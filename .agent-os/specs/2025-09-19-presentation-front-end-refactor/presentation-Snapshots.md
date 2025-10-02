Here’s how I’d tackle a presentation‑ready snapshot layer without clogging the simulator core:

1. Add a dedicated presentation aggregator
Create a sibling to daily-aggregator.ts, e.g. engine/src/simulation/post-processing/presentation-aggregator.ts. It should accept either the raw SimulationResults or (more likely) the DailyAggregateSnapshot[] you already compute and emit a PresentationSnapshot per day that matches the spec:

timeline: id/label/day plus cumulative and daily metrics (revenue, players, fees) shaped exactly as the new scrubber needs.
financialWorkflow: predefined node/link model—platform fee layers, charity layered shares, player payout nodes—so the SVG flow diagram binds straight to the JSON.
charts:
distributionSeries: daily percentages or amounts ready for the stacked chart.
accumulationSeries: cumulative series (platform vs charity vs payouts) keyed by the chart IDs.
Optional manifest metadata (parameter combo, duration) if the spec calls for it.
This keeps chart/presentation logic centralized and versioned alongside the simulation.

2. Update the dataset writer pipeline
Reuse the existing dataset-writer.ts to drop another file (presentation-snapshots.json). Extend DatasetArtifactPaths/DatasetArtifactContent to carry the extra path/content, and gate it behind a config toggle (default true).

When the orchestrator finishes a run:

Ensure daily aggregates exist (via generateDailyAggregates).
Feed them into the presentation aggregator to get PresentationSnapshot[].
Serialize alongside dataset.json and daily-snapshots.json.
Emit metadata (e.g. metadata.presentationSnapshots = path) so the UI knows where to load the new file.
3. CLI runner & dump script
For the run-orchestrator script, make --no-presentation (mirroring --no-events). Default to writing everything.
Update dump-anchor.ts to call the presentation aggregator too, so a quick sample run mirrors production. This keeps anchor-001 consistent with the CLI output.
4. Keep structure modular
daily-aggregator.ts: base financial/players aggregations (already in place).
presentation-aggregator.ts: pure transform from daily aggregates to the presentation contract.
dataset-writer.ts: orchestrated writes for dataset, metadata, daily snapshots, events, presentation snapshots.
Optionally add presentation-manifest.ts later to build cross-anchor manifests if the front end expects them.
5. Notes on implementation details
Leverage existing rounding helpers so the presentation JSON stays deterministic.
Guard against stack growth / recursion (presentation aggregator should be iterative).
Ensure the new file goes under anchor-datasets/<combo>/presentation-snapshots.json so git diffing and front-end imports are predictable.
Update metadata schema to record presentationSnapshotCount and presentationFile.
With that, the simulator continues to output its canonical dataset.json, while you add a well-structured presentation artifact tailored to the new UI—no need for the front end to reconstruct totals or chart series on every render.